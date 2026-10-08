/* Loomwright launcher: setup -> start server in background -> open browser.
   Build: x86_64-w64-mingw32-gcc -O2 -municode -mwindows -static launcher.c -o Loomwright.exe -lws2_32 -lshell32 */
#define WIN32_LEAN_AND_MEAN
#include <winsock2.h>
#include <windows.h>
#include <shellapi.h>
#include <wchar.h>

#define PORT 8000
#define URL  L"http://127.0.0.1:8000"

static int port_open(void) {
    WSADATA w; SOCKET s; struct sockaddr_in a; int ok;
    WSAStartup(MAKEWORD(2, 2), &w);
    s = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    a.sin_family = AF_INET; a.sin_port = htons(PORT); a.sin_addr.s_addr = inet_addr("127.0.0.1");
    ok = connect(s, (struct sockaddr *)&a, sizeof a) == 0;
    closesocket(s); WSACleanup();
    return ok;
}

/* Run a command line. visible: show a console window. wait: block until it exits. Returns exit code. */
static DWORD run(const wchar_t *cmd, int visible, int wait) {
    STARTUPINFOW si = { sizeof si }; PROCESS_INFORMATION pi; DWORD code = 1;
    wchar_t buf[2048]; wcsncpy(buf, cmd, 2047); buf[2047] = 0;
    if (!CreateProcessW(NULL, buf, NULL, NULL, FALSE,
                        visible ? CREATE_NEW_CONSOLE : CREATE_NO_WINDOW, NULL, NULL, &si, &pi))
        return 9999;
    if (wait) { WaitForSingleObject(pi.hProcess, INFINITE); GetExitCodeProcess(pi.hProcess, &code); }
    else code = 0;
    CloseHandle(pi.hProcess); CloseHandle(pi.hThread);
    return code;
}

static void fail(const wchar_t *msg) { MessageBoxW(NULL, msg, L"Loomwright", MB_OK | MB_ICONERROR); }

int WINAPI wWinMain(HINSTANCE h, HINSTANCE p, PWSTR args, int show) {
    wchar_t dir[MAX_PATH]; int i;
    GetModuleFileNameW(NULL, dir, MAX_PATH);
    wchar_t *slash = wcsrchr(dir, L'\\'); if (slash) *slash = 0;
    SetCurrentDirectoryW(dir);

    /* "Loomwright.exe --stop" shuts the background server down */
    if (args && wcsstr(args, L"--stop")) {
        run(L"cmd /c for /f \"tokens=5\" %a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do taskkill /PID %a /F", 0, 1);
        MessageBoxW(NULL, L"Loomwright server stopped.", L"Loomwright", MB_OK | MB_ICONINFORMATION);
        return 0;
    }

    if (GetFileAttributesW(L"server.js") == INVALID_FILE_ATTRIBUTES) {
        fail(L"server.js was not found.\n\nPut Loomwright.exe inside the Loomwright project folder (next to server.js).");
        return 1;
    }
    if (!port_open()) {
        if (run(L"cmd /c node --version", 0, 1) != 0) {
            fail(L"Node.js is not installed.\n\nThe download page will open. Install the LTS version, then run Loomwright again.");
            ShellExecuteW(NULL, L"open", L"https://nodejs.org/en/download", NULL, NULL, SW_SHOWNORMAL);
            return 1;
        }
        if (GetFileAttributesW(L"node_modules") == INVALID_FILE_ATTRIBUTES) {
            MessageBoxW(NULL, L"First-time setup: installing dependencies.\nA console window will show progress and close itself.", L"Loomwright", MB_OK | MB_ICONINFORMATION);
            if (run(L"cmd /c npm install", 1, 1) != 0) { fail(L"npm install failed. Check your internet connection and try again."); return 1; }
        }
        CreateDirectoryW(L".loomwright-data", NULL);
        SetEnvironmentVariableW(L"PORT", L"8000");
        run(L"cmd /c node server.js >> .loomwright-data\\server.log 2>&1", 0, 0);
        for (i = 0; i < 80 && !port_open(); i++) Sleep(250);
        if (!port_open()) { fail(L"The server did not start.\n\nSee .loomwright-data\\server.log for details."); return 1; }
    }
    ShellExecuteW(NULL, L"open", URL, NULL, NULL, SW_SHOWNORMAL);
    return 0;
}
