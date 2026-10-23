# ==============================================================================
# GNOME Clipboard Makefile
# ------------------------------------------------------------------------------
# Professional Makefile to build, pack, and manage the GNOME extension.
# ==============================================================================

EXT_NAME = gnome-clipboard
UUID = $(EXT_NAME)@b00f.github.io
BUNDLE = $(UUID).shell-extension.zip
POT_FILE = ./po/$(EXT_NAME).pot

# Directories
SRC_DIR = src
DIST_DIR = dist
BUILD_DIR = $(SRC_DIR)/build

# Assets
ASSETS = README.md LICENSE metadata.json
ASSET_DIRS = schemas po
STYLES = $(wildcard $(SRC_DIR)/*.css)
TS_SOURCES = $(wildcard $(SRC_DIR)/*.ts)

# Colors for output (real ANSI escapes, resolved once at parse time)
GREEN := $(shell printf '\033[0;32m')
NC := $(shell printf '\033[0m')

# Tools
# Use system tsc if available, otherwise fallback to npx (no node_modules required)
TSC := $(shell command -v tsc 2> /dev/null || echo "npx -p typescript tsc")

.PHONY: all build compile pack install enable disable clean update-translations listen test

all: build

build: pack

depcheck:
	@if ! command -v tsc >/dev/null && ! command -v npx >/dev/null; then \
		echo "Error: Neither 'tsc' nor 'npx' found. Please install TypeScript."; \
		exit 1; \
	fi

clean:
	@echo "Cleaning artifacts..."
	@rm -rf $(DIST_DIR) $(BUILD_DIR) $(BUNDLE)

compile: depcheck
	@bash scripts/transpile.sh

pack: compile
	@echo "$(GREEN)Packing extension...$(NC)"
	@cd $(DIST_DIR) && gnome-extensions pack --force --gettext-domain=$(EXT_NAME) --podir=../po $$(find . -maxdepth 1 -name "*.js" ! -name "extension.js" ! -name "prefs.js" -printf "--extra-source=%f ") . && mv $(BUNDLE) ..
	@echo "$(GREEN)Extension packed: $(BUNDLE)$(NC)"

install: pack
	@gnome-extensions install $(BUNDLE) --force
	@echo "$(GREEN)Extension installed!$(NC)"

enable:
	@gnome-extensions enable $(UUID)
	@echo "$(GREEN)Extension enabled!$(NC)"

disable:
	@gnome-extensions disable $(UUID)
	@echo "$(GREEN)Extension disabled!$(NC)"

update-translations:
	@xgettext -L JavaScript --no-wrap --no-location --sort-by-file --from-code=UTF-8 -k_ -kN_ -o $(POT_FILE) $(DIST_DIR)/*.js --package-name $(EXT_NAME)
	@for f in ./po/*.po ; do \
		msgmerge --no-location -N $$f $(POT_FILE) -o $$f ;\
	done

listen:
	journalctl -o cat -n 0 -f "$$(which gnome-shell)" | grep -v warning

test: install enable restart-shell

restart-shell:
	@echo "Restarting shell..."
	@if bash -c 'xprop -root &> /dev/null'; then \
		pkill -HUP gnome-shell; \
	else \
		gnome-session-quit --logout; \
	fi
