const { app, BrowserWindow } = require('electron')
const path = require('path')

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            // Standard secure defaults for a web app wrapper
            nodeIntegration: false,
            contextIsolation: true
        }
    })

    // [Fix] Inject specific headers to bypass API security checks
    const filter = {
        urls: ['https://waypoint-api-rho.vercel.app/*']
    }

    win.webContents.session.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
        details.requestHeaders['Origin'] = 'https://waypointeditor.vercel.app'
        details.requestHeaders['Referer'] = 'https://waypointeditor.vercel.app/'
        callback({ requestHeaders: details.requestHeaders })
    })

    win.loadFile('index.html')
    // win.webContents.openDevTools() // Optional: for debugging
}

app.whenReady().then(() => {
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
