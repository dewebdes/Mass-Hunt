package burp;

import java.io.PrintWriter;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.net.http.WebSocket.Listener;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.CompletionStage;

public class MassHunt implements IHttpListener, IBurpExtender {

    private IBurpExtenderCallbacks callbacks;
    private IExtensionHelpers helpers;
    private WebSocket wsClient;

    private PrintWriter stdout;
    private PrintWriter stderr;

    private final Map<String, byte[]> requestMap = new HashMap<>();
    private final Map<String, Long> requestTimeMap = new HashMap<>();
    private int feedCounter = 0;
    private static final String DELIMITER = "#massmirror#";

    @Override
    public void registerExtenderCallbacks(IBurpExtenderCallbacks callbacks) {
        this.callbacks = callbacks;
        this.helpers = callbacks.getHelpers();
        callbacks.setExtensionName("MassHunt");
        callbacks.registerHttpListener(this);

        stdout = new PrintWriter(callbacks.getStdout(), true);
        stderr = new PrintWriter(callbacks.getStderr(), true);

        stdout.println("[MassHunt] Extension initialized.");
        connectToSocket("ws://localhost:9090");
    }

    private void connectToSocket(String uri) {
        try {
            HttpClient client = HttpClient.newHttpClient();
            wsClient = client.newWebSocketBuilder().buildAsync(
                    URI.create(uri),
                    new Listener() {
                        @Override
                        public CompletionStage<?> onText(WebSocket ws, CharSequence message, boolean last) {
                            return null;
                        }
                    }).join();
            stdout.println("[MassHunt] WebSocket connected to: " + uri);
        } catch (Exception e) {
            stderr.println("[MassHunt] Failed to connect WebSocket: " + e.getMessage());
        }
    }

    @Override
    public void processHttpMessage(int toolFlag, boolean messageIsRequest, IHttpRequestResponse message) {
        String key = generateKey(message);

        if (messageIsRequest) {
            requestMap.put(key, message.getRequest());
            requestTimeMap.put(key, System.currentTimeMillis());
            return;
        }

        byte[] req = requestMap.remove(key);
        byte[] res = message.getResponse();
        Long startTime = requestTimeMap.remove(key);
        long pulseMs = (startTime != null) ? (System.currentTimeMillis() - startTime) : -1;

        if (req == null || res == null) {
            stderr.println("[Warning] Missing request or response for FEED-" + feedCounter);
            return;
        }

        IRequestInfo reqInfo = helpers.analyzeRequest(req);
        IResponseInfo resInfo = helpers.analyzeResponse(res);

        String method = reqInfo.getMethod();

        String url;
        try {
            url = reqInfo.getUrl().toString();
        } catch (UnsupportedOperationException e) {
            IHttpService service = message.getHttpService();
            if (service != null) {
                String host = service.getHost();
                int port = service.getPort();
                String protocol = service.getProtocol();
                url = protocol + "://" + host + ":" + port + reqInfo.getHeaders().stream()
                        .filter(h -> h.startsWith("GET") || h.startsWith("POST"))
                        .map(h -> h.split(" ")[1])
                        .findFirst().orElse("/UNKNOWN");
            } else {
                url = "UNKNOWN_URL";
            }
        }

        String reqHeaders = String.join("\n", reqInfo.getHeaders());
        String reqBody = extractBody(req, reqInfo.getBodyOffset());
        String resHeaders = String.join("\n", resInfo.getHeaders());
        String resBody = extractBody(res, resInfo.getBodyOffset());

        String feedId = "FEED-" + (++feedCounter);
        String structuredFeed = String.join(DELIMITER,
                "PAIR_FEED:" + feedId,
                Long.toString(pulseMs),
                method,
                url,
                reqHeaders,
                reqBody,
                resHeaders,
                resBody);

        wsClient.sendText(structuredFeed, true);
        stdout.println("[Sent] " + feedId + " → " + method + " " + url + " [" + pulseMs + "ms]");
    }

    private String extractBody(byte[] bytes, int offset) {
        if (bytes == null || offset < 0 || offset >= bytes.length)
            return "";
        byte[] body = Arrays.copyOfRange(bytes, offset, bytes.length);
        return new String(body, StandardCharsets.UTF_8);
    }

    private String generateKey(IHttpRequestResponse message) {
        IRequestInfo info = helpers.analyzeRequest(message);
        String host = info.getUrl().getHost();
        String path = info.getUrl().getPath();
        String method = info.getMethod();
        return host + "|" + method + "|" + path;
    }
}
