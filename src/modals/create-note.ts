import { App, Modal, Setting } from "obsidian";

export type PropertyType = "text" | "checkbox" | "tags" | "number" | "date";

export interface PropertyEntry {
	key: string;
	value: string;
	type?: PropertyType; // defaults to "text" when absent — keeps old callers (view.ts) working unchanged
}

interface PropertyPreset {
	key: string; // default frontmatter key, "" means user must type their own
	type: PropertyType;
	label: string;
	icon: string;
	placeholder?: string;
}

const PROPERTY_PRESETS: PropertyPreset[] = [
	{ key: "tags", type: "tags", label: "Tags", icon: "🏷️", placeholder: "tag1, tag2" },
	{ key: "checkbox", type: "checkbox", label: "Checkbox", icon: "✅" },
	{ key: "banner", type: "text", label: "Banner", icon: "🖼️", placeholder: "https://..." },
	{ key: "rating", type: "number", label: "Rating", icon: "⭐" },
	{ key: "status", type: "text", label: "Status", icon: "📌", placeholder: "e.g. In Progress" },
	{ key: "date", type: "date", label: "Date", icon: "📅" },
	{ key: "", type: "text", label: "Custom Property", icon: "✍️", placeholder: "value" },
];

export class CreateNoteModal extends Modal {
	private onSubmit: (title: string, properties: PropertyEntry[]) => void;
	private defaultProperties: PropertyEntry[];
	private currentFolder: string;
	private isPresetMenuOpen: boolean = false;
	private invalidKeyIndices: Set<number> = new Set();
	private errorBannerEl: HTMLElement | null = null;

	// v3.0.11: the preset popover lives on document.body, not inside
	// contentEl. Obsidian's modal wrapper applies a CSS transform for its
	// open/close animation, and any descendant with position:fixed gets
	// repositioned relative to that transformed ancestor instead of the
	// viewport — which is what broke the layout. Body-attaching sidesteps
	// that entirely (same fix pattern as FolderSuggest in settings.ts).
	private presetMenuEl: HTMLElement | null = null;
	private outsideClickHandler: ((e: MouseEvent) => void) | null = null;

	constructor(
		app: App,
		onSubmit: (title: string, properties: PropertyEntry[]) => void,
		defaultProperties: PropertyEntry[] = [],
		currentFolder: string = "",
	) {
		super(app);
		this.onSubmit = onSubmit;
		this.defaultProperties = defaultProperties.map((p) => ({
			key: p.key,
			value: p.value,
			type: p.type || "text",
		}));
		this.currentFolder = currentFolder;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h3", {
			text: "Create New Note",
			attr: { style: "margin-top: 0; margin-bottom: 4px;" },
		});

		if (this.currentFolder) {
			contentEl.createDiv({
				text: `Location: ${this.currentFolder || "Root"}`,
				attr: {
					style: "font-size: 0.8em; color: var(--text-muted); margin-bottom: 12px; font-family: var(--font-monospace);",
				},
			});
		}

		let noteTitle = "Untitled Note";
		new Setting(contentEl).setName("Note Title").addText((text) =>
			text
				.setPlaceholder("Untitled Note")
				.setValue(noteTitle)
				.onChange((value) => {
					noteTitle = value;
				}),
		);

		const propsHeader = contentEl.createDiv({
			attr: {
				style: "margin-top: 20px; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;",
			},
		});
		propsHeader.createEl("h4", {
			text: "📋 Properties",
			attr: { style: "margin: 0;" },
		});

		const infoDiv = contentEl.createDiv({
			attr: {
				style: "font-size: 0.75em; color: var(--text-muted); margin-bottom: 8px; padding: 6px 10px; background: var(--background-secondary); border-radius: 4px;",
			},
		});
		infoDiv.setText(
			"ℹ️ Properties shown below will be added to the note frontmatter. Plugins like Folder Auto Properties or Templater may add additional properties when the note is created.",
		);

		const propertiesContainer = contentEl.createDiv({
			cls: "gallery-create-note-properties",
		});

		const renderProperties = () => {
			propertiesContainer.empty();

			if (this.defaultProperties.length === 0) {
				propertiesContainer.createDiv({
					text: "No properties defined yet. Click '+ Add Property' to start.",
					attr: {
						style: "text-align: center; padding: 12px; color: var(--text-faint); font-style: italic; font-size: 0.85em;",
					},
				});
				return;
			}

			this.defaultProperties.forEach((prop, index) => {
				const row = propertiesContainer.createDiv({
					cls: "gallery-property-row",
				});
				row.setCssProps({
					display: "flex",
					alignItems: "center",
					gap: "6px",
					flexWrap: "wrap",
				});

				const preset = PROPERTY_PRESETS.find(
					(p) => p.type === prop.type && p.key === prop.key,
				);
				const icon = preset?.icon || "🔤";
				const isInvalid = this.invalidKeyIndices.has(index);

				row.createSpan({
					text: icon,
					attr: { style: "flex-shrink: 0; font-size: 0.9em;" },
				});

				const isCustom = !PROPERTY_PRESETS.some(
					(p) => p.key === prop.key && p.key !== "",
				);

				if (isCustom) {
					const keyInput = row.createEl("input", {
						type: "text",
						value: prop.key,
						placeholder: "key (required)",
						cls: "gallery-property-key-input",
					});
					keyInput.setCssProps({
						width: "110px",
						padding: "4px 8px",
						fontSize: "0.85em",
						borderRadius: "4px",
						border: isInvalid
							? "1.5px solid var(--text-error)"
							: "1px solid var(--background-modifier-border)",
						background: isInvalid
							? "rgba(var(--text-error-rgb), 0.06)"
							: "var(--background-primary)",
					});
					keyInput.addEventListener("input", () => {
						const entry = this.defaultProperties[index];
						if (entry) entry.key = keyInput.value;
						if (
							this.invalidKeyIndices.has(index) &&
							keyInput.value.trim().length > 0
						) {
							this.invalidKeyIndices.delete(index);
							keyInput.setCssProps({
								border: "1px solid var(--background-modifier-border)",
								background: "var(--background-primary)",
							});
							if (this.invalidKeyIndices.size === 0) {
								this.hideErrorBanner();
							}
						}
					});
				} else {
					row.createSpan({
						text: prop.key,
						attr: {
							style: "width: 90px; font-size: 0.85em; font-weight: 600; color: var(--text-normal); flex-shrink: 0;",
						},
					});
				}

				const valueSlot = row.createDiv({
					attr: { style: "display: flex; align-items: center; flex: 1; min-width: 100px;" },
				});

				const entry = this.defaultProperties[index];
				const currentType = entry?.type || "text";

				if (currentType === "checkbox") {
					const wrapper = valueSlot.createDiv({
						attr: {
							style: "display: flex; align-items: center; gap: 6px; cursor: pointer;",
						},
					});
					const checkboxInput = wrapper.createEl("input", {
						type: "checkbox",
						cls: "gallery-property-checkbox-toggle",
					});
					checkboxInput.checked = prop.value === "true";
					checkboxInput.setCssProps({ cursor: "pointer" });
					const stateLabel = wrapper.createSpan({
						text: checkboxInput.checked ? "True" : "False",
						attr: {
							style: "font-size: 0.8em; color: var(--text-muted);",
						},
					});
					checkboxInput.addEventListener("change", () => {
						const e = this.defaultProperties[index];
						if (!e) return;
						e.value = checkboxInput.checked ? "true" : "false";
						stateLabel.setText(checkboxInput.checked ? "True" : "False");
					});
				} else if (currentType === "tags") {
					const tagsInput = valueSlot.createEl("input", {
						type: "text",
						value: prop.value,
						placeholder: "tag1, tag2, tag3",
						cls: "gallery-property-value-input gallery-property-tags-input",
					});
					tagsInput.setCssProps({
						width: "100%",
						padding: "4px 8px",
						fontSize: "0.85em",
						borderRadius: "4px",
						border: "1px solid var(--background-modifier-border)",
						background: "var(--background-primary)",
					});
					tagsInput.addEventListener("input", () => {
						const e = this.defaultProperties[index];
						if (e) e.value = tagsInput.value;
					});
				} else if (currentType === "number") {
					const numberInput = valueSlot.createEl("input", {
						type: "number",
						value: prop.value,
						placeholder: "0",
						cls: "gallery-property-value-input",
					});
					numberInput.setCssProps({
						width: "100%",
						padding: "4px 8px",
						fontSize: "0.85em",
						borderRadius: "4px",
						border: "1px solid var(--background-modifier-border)",
						background: "var(--background-primary)",
					});
					numberInput.addEventListener("input", () => {
						const e = this.defaultProperties[index];
						if (e) e.value = numberInput.value;
					});
				} else if (currentType === "date") {
					const dateInput = valueSlot.createEl("input", {
						type: "date",
						value: prop.value,
						cls: "gallery-property-value-input",
					});
					dateInput.setCssProps({
						width: "100%",
						padding: "4px 8px",
						fontSize: "0.85em",
						borderRadius: "4px",
						border: "1px solid var(--background-modifier-border)",
						background: "var(--background-primary)",
					});
					dateInput.addEventListener("input", () => {
						const e = this.defaultProperties[index];
						if (e) e.value = dateInput.value;
					});
				} else {
					const textInput = valueSlot.createEl("input", {
						type: "text",
						value: prop.value,
						placeholder: preset?.placeholder || "value",
						cls: "gallery-property-value-input",
					});
					textInput.setCssProps({
						width: "100%",
						padding: "4px 8px",
						fontSize: "0.85em",
						borderRadius: "4px",
						border: "1px solid var(--background-modifier-border)",
						background: "var(--background-primary)",
					});
					textInput.addEventListener("input", () => {
						const e = this.defaultProperties[index];
						if (e) e.value = textInput.value;
					});
				}

				const deleteBtn = row.createEl("button", {
					text: "×",
					attr: { "aria-label": "Remove property" },
				});
				deleteBtn.setCssProps({
					padding: "2px 8px",
					fontSize: "1em",
					cursor: "pointer",
					border: "none",
					background: "transparent",
					color: "var(--text-muted)",
					borderRadius: "4px",
				});
				deleteBtn.addEventListener("click", () => {
					this.defaultProperties.splice(index, 1);
					this.invalidKeyIndices.clear();
					this.hideErrorBanner();
					renderProperties();
				});
			});
		};

		renderProperties();

		// ----- "+ Add Property" button opens a preset picker popover -----
		const addPropBtn = contentEl.createEl("button", {
			text: "+ Add Property",
			cls: "gallery-add-property-btn",
			attr: { style: "margin-top: 8px;" },
		});
		addPropBtn.setCssProps({
			padding: "4px 12px",
			fontSize: "0.8em",
			cursor: "pointer",
			background: "var(--background-secondary)",
			border: "1px solid var(--background-modifier-border)",
			borderRadius: "4px",
			color: "var(--text-muted)",
		});

		// Build the popover once, attached to <body> — never to contentEl —
		// so the modal's transform can't corrupt its fixed positioning.
		this.presetMenuEl = window.activeDocument.body.createDiv({
			attr: {
				style: "display: none; position: fixed; background: var(--background-secondary-alt); border: 1px solid var(--background-modifier-border); border-radius: 8px; padding: 6px; flex-direction: column; gap: 2px; z-index: 9999; min-width: 190px; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);",
			},
		});
		const presetMenu = this.presetMenuEl;

		const closePresetMenu = () => {
			this.isPresetMenuOpen = false;
			presetMenu.setCssProps({ display: "none" });
		};

		PROPERTY_PRESETS.forEach((preset) => {
			const item = presetMenu.createDiv({
				text: `${preset.icon}  ${preset.label}`,
				attr: {
					style: "padding: 7px 10px; font-size: 0.85em; font-weight: 500; border-radius: 6px; cursor: pointer;",
				},
			});
			item.addEventListener("mouseenter", () => {
				item.setCssProps({ background: "var(--background-modifier-hover)" });
			});
			item.addEventListener("mouseleave", () => {
				item.setCssProps({ background: "transparent" });
			});
			item.addEventListener("mousedown", (e: MouseEvent) => {
				e.preventDefault();
				e.stopPropagation();
				this.defaultProperties.push({
					key: preset.key,
					value: preset.type === "checkbox" ? "false" : "",
					type: preset.type,
				});
				closePresetMenu();
				renderProperties();
			});
		});

		addPropBtn.addEventListener("click", (e: MouseEvent) => {
			e.stopPropagation();
			this.isPresetMenuOpen = !this.isPresetMenuOpen;
			if (this.isPresetMenuOpen) {
				const btnRect = addPropBtn.getBoundingClientRect();
				presetMenu.setCssProps({
					display: "flex",
					top: `${btnRect.bottom + 4}px`,
					left: `${btnRect.left}px`,
				});
			} else {
				presetMenu.setCssProps({ display: "none" });
			}
		});

		// Close the popover on any click outside it or the trigger button —
		// needed now that it's body-attached and won't auto-dismiss with the modal.
		this.outsideClickHandler = (e: MouseEvent) => {
			if (
				this.isPresetMenuOpen &&
				presetMenu &&
				!presetMenu.contains(e.target as Node) &&
				e.target !== addPropBtn
			) {
				closePresetMenu();
			}
		};
		window.activeDocument.addEventListener("click", this.outsideClickHandler);

		// ----- Error banner -----
		this.errorBannerEl = contentEl.createDiv({
			attr: {
				style: "display: none; margin-top: 10px; padding: 8px 12px; font-size: 0.8em; font-weight: 600; color: var(--text-error); background: rgba(var(--text-error-rgb), 0.1); border: 1px solid rgba(var(--text-error-rgb), 0.3); border-radius: 6px;",
			},
		});

		// Footer buttons
		const footerBtnRow = contentEl.createDiv({
			attr: {
				style: "display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px;",
			},
		});
		const cancelBtn = footerBtnRow.createEl("button", { text: "Cancel" });
		const confirmBtn = footerBtnRow.createEl("button", {
			text: "Create",
			cls: "mod-cta",
		});

		cancelBtn.addEventListener("click", () => this.close());
		confirmBtn.addEventListener("click", () => {
			this.invalidKeyIndices.clear();
			this.defaultProperties.forEach((p, index) => {
				if (p.key.trim().length === 0) {
					this.invalidKeyIndices.add(index);
				}
			});

			if (this.invalidKeyIndices.size > 0) {
				this.showErrorBanner(
					this.invalidKeyIndices.size === 1
						? "One property is missing a key. Give it a name before creating the note — an empty key won't be saved to the frontmatter."
						: `${this.invalidKeyIndices.size} properties are missing a key. Give each one a name before creating the note.`,
				);
				renderProperties();
				return;
			}

			this.hideErrorBanner();

			const finalProps = this.defaultProperties.map((p) => {
				let finalValue = p.value;
				switch (p.type) {
					case "checkbox":
						finalValue = p.value === "true" ? "true" : "false";
						break;
					case "tags": {
						const tags = p.value
							.split(",")
							.map((t) => t.trim())
							.filter(Boolean);
						finalValue = `[${tags.join(", ")}]`;
						break;
					}
					case "number":
						finalValue = p.value.trim() === "" ? "0" : p.value.trim();
						break;
					case "date":
						finalValue = p.value.trim();
						break;
					default:
						finalValue = p.value;
				}
				return { key: p.key.trim(), value: finalValue };
			});
			this.onSubmit(noteTitle.trim(), finalProps);
			this.close();
		});
	}

	private showErrorBanner(message: string) {
		if (!this.errorBannerEl) return;
		this.errorBannerEl.setText(`⚠️ ${message}`);
		this.errorBannerEl.setCssProps({ display: "block" });
	}

	private hideErrorBanner() {
		if (!this.errorBannerEl) return;
		this.errorBannerEl.setCssProps({ display: "none" });
	}

	onClose() {
		this.contentEl.empty();
		// Body-attached elements aren't cleaned up by contentEl.empty() —
		// remove them explicitly to avoid leaking a detached menu/listener
		// every time this modal opens and closes.
		if (this.presetMenuEl) {
			this.presetMenuEl.remove();
			this.presetMenuEl = null;
		}
		if (this.outsideClickHandler) {
			window.activeDocument.removeEventListener(
				"click",
				this.outsideClickHandler,
			);
			this.outsideClickHandler = null;
		}
	}
}