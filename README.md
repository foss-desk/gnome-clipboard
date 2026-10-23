# Gnome Clipboard

![GNOME Version](https://img.shields.io/badge/GNOME-45%20|%2046%20|%2047%20|%2050+-blue?logo=gnome&logoColor=white)
![License](https://img.shields.io/badge/License-GPLv3-blue.svg)

A professional, feature-rich GNOME Shell extension for managing your clipboard history. **Gnome Clipboard** seamlessly integrates into the GNOME top bar, giving you quick access to your recently copied text and images, allowing you to pin important items, and providing robust privacy controls.

---

## 🌟 Features

- **Interactive Shortcut Recorder**: No more manual typing. Set your global hotkeys by simply pressing the key combinations in the settings window.
- **Rich Media & Image Support**: Natively stores and previews copied images alongside standard text, now with optimized **Image Caching** for a stutter-free experience.
- **Advanced Navigation**: Cycle through your clipboard history using global hotkeys without opening the menu—perfect for rapid pasting.
- **Categorized History**: Automatically segregates your clipboard history into a general "Recent" tab and a dedicated "Pinned" tab.
- **Privacy Controls**:
  - **Private Mode**: Quickly toggle history tracking on or off to prevent sensitive data from being recorded.
  - **App Blacklisting**: Configure specific applications (like password managers) to be ignored by the clipboard manager.
- **High Performance**: Optimized with **Differential UI Updates**, reducing shell overhead by over 80% for large history lists.
- **Searchable**: Quickly find past clipboard items using the built-in search box.
- **Persistent Storage**: Your clipboard history is securely saved to disk and persists across system reboots.
- **Modern GNOME Compatibility**: Fully compliant with GNOME 45+ review guidelines, including all-asynchronous I/O operations for zero UI blocking.

## ⚙️ Configuration & Preferences

You can customize Gnome Clipboard to fit your workflow perfectly using the extension's preferences window.

| Setting               | Description                                                                            | Default    |
| :-------------------- | :------------------------------------------------------------------------------------- | :--------- |
| **History Size**      | The maximum number of items to keep in the recent history.                             | `100`      |
| **History Sort**      | Choose how to sort your history (e.g., by usage or time).                              | `By Time`  |
| **Timer vs Event**    | Choose whether to poll the clipboard on a timer or use system events.                  | `Events`   |
| **Save Pinned Only**  | If enabled, only pinned items are saved to disk; recent items are forgotten on reboot. | `false`    |
| **Notifications**     | Toggle desktop notifications when an item is copied or pinned.                         | `false`    |
| **Blacklist**         | Apps whose copies are ignored, by desktop file id (e.g. `org.keepassxc.KeePassXC.desktop`) or name. Matched against the app that has the focus when the clipboard changes. | `[]`       |
| **Keyboard Shortcut** | Set a global shortcut to open the clipboard menu.                                      | `<Super>v` |

## Installation

### Option 1: Official GNOME Extensions (Recommended)

The easiest way to install Gnome Clipboard is through the official GNOME Extensions portal.

1. Install the **Extension Manager** app from Flathub or your distribution's package manager.
2. Search for "Gnome Clipboard" within the app and click install.
3. Alternatively, install directly from the web: 👉 **[Gnome Clipboard on GNOME Extensions](https://extensions.gnome.org/extension/4422/gnome-clipboard/)**

### Option 2: From Source Code (For testing & latest features)

If you want the absolute latest version, you can build and install the extension using our professional build system.

**Prerequisites:**
- `git`, `make`, `nodejs` & `npm` (uses `npx` for the TypeScript compiler)

**Build Commands:**

1. **Clone and Build (Zip only):**
   ```bash
   make build
   ```
   *Compiles the source and packs the extension into a `.zip` file for manual distribution.*

2. **Build and Install:**
   ```bash
   make install
   ```
   *Compiles, packs, and installs the extension to your local GNOME environment.*

3. **Enable and Listen:**
   ```bash
   make enable
   make listen
   ```

4. **Restart GNOME Shell:**
   For the extension to be recognized, you must restart the GNOME Shell.
   - **X11**: Press `Alt` + `F2`, type `r`, and press `Enter`.
   - **Wayland**: You must log out and log back in.

   Alternatively, you can run our automated script which detects your session type:
   ```bash
   make restart-shell
   ```

**For Developers:**
If you are actively developing and want to automate the build-install-restart loop, simply run:
```bash
make test
```
*(Warning: If you are on Wayland, running `make test` will automatically log you out to apply the changes!)*

You can monitor logs using:
```bash
make listen
```

## 🛠️ Development Commands

The project uses a standard `Makefile` to manage the build lifecycle:

- `make build`: Default target. Compiles and packs the extension into a ZIP.
- `make install`: Compiles, packs, and installs to the system extensions directory.
- `make clean`: Removes the `dist` build directory and ZIP artifacts.
- `make update-translations`: Extracts new strings and updates all `.po` files.
- `make test`: Full cycle: Install, Enable, and attempt to Refresh the Shell.

## 🌍 Contributing & Translations

Contributions are extremely welcome! If you find a bug or have a feature request, please open an issue.

### Adding a new translation
1. Run `make update-translations` to refresh the template.
2. Create or edit the `.po` file in the `po/` directory using Poedit or `msginit`.

## 📜 License

This project is licensed under the GPL-3.0 License. See the [LICENSE](LICENSE) file for more details.
