import Shell from 'gi://Shell';
import Meta from 'gi://Meta';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import * as ClipboardPanel from './clipboardPanel.js';
import * as ClipboardItem from './clipboardItem.js';
import * as ActionBar from './actionBar.js';
import * as ConfirmDialog from './confirmDialog.js';
import * as HistoryMenu from './historyMenu.js';
import * as MenuItem from './menuItem.js';
import * as SearchBox from './searchBox.js';
import * as log from './log.js';
import * as Settings from './settings.js';

export default class GnomeClipboardExtension extends Extension {
    private _panel: ClipboardPanel.ClipboardPanel | null = null;

    enable() {
        log.info(`enabling...`);
        
        // Initialize logging with settings
        log.init(this.getSettings(Settings.SCHEMA_ID));

        if (!this._panel) {
            // Every module keeps its own `_`, so each one has to be handed the
            // extension's gettext or its strings stay in English.
            const gettext = this.gettext.bind(this);
            for (const mod of [ClipboardPanel, ClipboardItem, ActionBar, ConfirmDialog, HistoryMenu, MenuItem, SearchBox])
                mod.init(gettext);
            this._panel = new ClipboardPanel.ClipboardPanel(
                this.getSettings(Settings.SCHEMA_ID),
                this.gettext.bind(this),
                this.uuid,
                () => this.openPreferences()
            );
            Main.panel.addToStatusArea(this.uuid, this._panel);
            if (this._panel) this._panel.init();
        }

        this._addKeybinding();
    }

    disable() {
        log.info(`disabling...`);
        this._removeKeybinding();

        if (this._panel) {
            this._panel.destroy();
            this._panel = null;
        }
    }

    private _addKeybinding() {
        const settings = this.getSettings(Settings.SCHEMA_ID);
        const wm = (Main as any).wm;

        wm.addKeybinding(Settings.SHORTCUT_MENU, settings, Meta.KeyBindingFlags.NONE, Shell.ActionMode.ALL, () => {
            if (this._panel) this._panel.toggle();
        });

        wm.addKeybinding(Settings.SHORTCUT_CLEAR, settings, Meta.KeyBindingFlags.NONE, Shell.ActionMode.ALL, () => {
            if (this._panel) this._panel.clearHistory();
        });

        wm.addKeybinding(Settings.SHORTCUT_PRIVATE_MODE, settings, Meta.KeyBindingFlags.NONE, Shell.ActionMode.ALL, () => {
            if (this._panel) this._panel.togglePrivateMode();
        });

        wm.addKeybinding(Settings.SHORTCUT_NEXT, settings, Meta.KeyBindingFlags.NONE, Shell.ActionMode.ALL, () => {
            if (this._panel) this._panel.selectNextItem();
        });

        wm.addKeybinding(Settings.SHORTCUT_PREV, settings, Meta.KeyBindingFlags.NONE, Shell.ActionMode.ALL, () => {
            if (this._panel) this._panel.selectPrevItem();
        });
    }

    private _removeKeybinding() {
        const wm = (Main as any).wm;
        wm.removeKeybinding(Settings.SHORTCUT_MENU);
        wm.removeKeybinding(Settings.SHORTCUT_CLEAR);
        wm.removeKeybinding(Settings.SHORTCUT_PRIVATE_MODE);
        wm.removeKeybinding(Settings.SHORTCUT_NEXT);
        wm.removeKeybinding(Settings.SHORTCUT_PREV);
    }
}
