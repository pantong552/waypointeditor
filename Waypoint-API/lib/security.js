/**
 * 安全性工具函數
 * 處理 CORS Header 與 Referer 檢查
 */

const ALLOWED_ORIGINS = [
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'https://localhost:5500',
    'https://127.0.0.1:5500',
    'https://waypointeditor.vercel.app'
];

const checkSecurity = (req, res) => {
    const origin = req.headers.origin;
    const referer = req.headers.referer;

    // 預設不允許
    let isAllowed = false;

    // 1. 如果有 Origin，檢查是否在允許清單中
    if (origin) {
        if (ALLOWED_ORIGINS.includes(origin)) {
            isAllowed = true;
            res.setHeader('Access-Control-Allow-Origin', origin);
        }
    } else {
        // 沒有 Origin 的情況 (可能是伺服器對伺服器請求)
        // 暫時設為 true，但在下方會受 Referer 檢查限制
        isAllowed = true;
    }

    // 2. 如果有 Referer，檢查是否在允許清單中
    if (referer) {
        try {
            const refererUrl = new URL(referer);
            const refererHost = `${refererUrl.protocol}//${refererUrl.host}`;

            const isRefererAllowed = ALLOWED_ORIGINS.some(allowed => refererHost === allowed);

            if (!isRefererAllowed) {
                isAllowed = false;
            } else {
                // 如果 Referer 是允許的且之前是來自 Origin 檢查的 disallowed，現在可以轉為 allowed
                isAllowed = true;
            }
        } catch (e) {
            isAllowed = false;
        }
    }

    // 3. 特殊處理：如果在本地開發且完全沒有標頭，可以視情況放行
    // 但為了安全，我們這裡實施嚴格檢查：如果既沒 Origin 也沒 Referer，則不允許 (除非是特定非瀏覽器工具)
    if (!origin && !referer) {
        // 為了讓本地 test-local.js 能跑，我們可以放行
        // 但如果您希望更嚴格，可以設為 false
        isAllowed = false;
    }

    // 設定基本的 CORS Header
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (!isAllowed) {
        res.status(403).json({ error: 'Access Denied: Origin or Referer not allowed' });
        return false;
    }

    return true;
};

module.exports = {
    checkSecurity,
    ALLOWED_ORIGINS
};
