package app.covo.mobile;

import android.app.DownloadManager;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.WebView;
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.UUID;

// Covo Android app: the standalone edition in a WebView, plus a tiny bridge
// (window.CovoAndroid) for things a WebView can't do on its own.
// The bridge only answers callers holding a key that is given to the top-level page,
// so sandboxed artifact frames (agent-made pages) can't use it.
public class MainActivity extends BridgeActivity {
    private final String key = UUID.randomUUID().toString();

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView web = getBridge().getWebView();
        web.addJavascriptInterface(new CovoBridge(), "CovoAndroid");
        getBridge().addWebViewListener(new WebViewListener() {
            @Override
            public void onPageLoaded(WebView view) {
                view.evaluateJavascript("window.CovoAndroidKey='" + key + "'", null);
            }
        });

        // Downloads from a connected Covo server (exports, artifacts) go to the Downloads folder.
        web.setDownloadListener((url, userAgent, contentDisposition, mimeType, length) -> {
            if (!url.startsWith("http")) return;
            try {
                String name = URLUtil.guessFileName(url, contentDisposition, mimeType);
                DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
                String cookies = CookieManager.getInstance().getCookie(url);
                if (cookies != null) req.addRequestHeader("Cookie", cookies);
                req.addRequestHeader("User-Agent", userAgent);
                req.setMimeType(mimeType);
                req.setTitle(name);
                req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
                ((DownloadManager) getSystemService(DOWNLOAD_SERVICE)).enqueue(req);
                toast("Downloading " + name);
            } catch (Exception e) {
                toast("Download failed: " + e.getMessage());
            }
        });
    }

    private void toast(String msg) {
        runOnUiThread(() -> Toast.makeText(this, msg, Toast.LENGTH_SHORT).show());
    }

    private class CovoBridge {
        // Outside links open in the browser / mail app instead of inside Covo.
        @JavascriptInterface
        public void openExternal(String k, String url) {
            if (!key.equals(k) || url == null || !(url.startsWith("https://") || url.startsWith("http://") || url.startsWith("mailto:") || url.startsWith("tel:"))) return;
            try {
                Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(i);
            } catch (Exception e) {
                toast("No app can open this link");
            }
        }

        // Files made in the app (backups, artifacts, exports) are saved to Downloads.
        @JavascriptInterface
        public void saveFile(String k, String name, String mime, String base64) {
            if (!key.equals(k)) return;
            String safe = (name == null || name.isEmpty() ? "covo-file" : name).replaceAll("[\\\\/:*?\"<>|]", "_");
            try {
                byte[] data = Base64.decode(base64, Base64.DEFAULT);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.Downloads.DISPLAY_NAME, safe);
                    v.put(MediaStore.Downloads.MIME_TYPE, mime == null || mime.isEmpty() ? "application/octet-stream" : mime);
                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                    if (uri == null) throw new Exception("no storage");
                    try (OutputStream out = getContentResolver().openOutputStream(uri)) { out.write(data); }
                    toast("Saved to Downloads: " + safe);
                } else {
                    File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    File f = new File(dir, safe);
                    try (FileOutputStream out = new FileOutputStream(f)) { out.write(data); }
                    toast("Saved: " + f.getAbsolutePath());
                }
            } catch (Exception e) {
                toast("Couldn't save: " + e.getMessage());
            }
        }
    }
}
