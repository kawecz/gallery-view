import { App, Modal, Setting } from "obsidian";

export class SetBannerModal extends Modal {
	private onConfirm: (url: string) => void;
	private currentUrl: string;
	private itemLabel: string;

	constructor(
		app: App,
		itemLabel: string,
		currentUrl: string,
		onConfirm: (url: string) => void,
	) {
		super(app);
		this.itemLabel = itemLabel;
		this.currentUrl = currentUrl;
		this.onConfirm = onConfirm;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h3", {
			text: `🖼️ Set Banner - ${this.itemLabel}`,
			attr: { style: "margin-top: 0;" },
		});

		let previewUrl = this.currentUrl;
		const previewWrap = contentEl.createDiv({
			attr: {
				style: "width: 100%; height: 140px; border-radius: 8px; overflow: hidden; margin-bottom: 12px; background: var(--background-secondary-alt); display: flex; align-items: center; justify-content: center;",
			},
		});

		const renderPreview = () => {
			previewWrap.empty();
			if (previewUrl) {
				previewWrap.createEl("img", {
					attr: {
						src: previewUrl,
						style: "width: 100%; height: 100%; object-fit: cover;",
					},
				});
			} else {
				previewWrap.createDiv({
					text: "No banner set - default will be used",
					attr: {
						style: "color: var(--text-muted); font-size: 0.85em; text-align: center; padding: 0 16px;",
					},
				});
			}
		};
		renderPreview();

		new Setting(contentEl)
			.setName("Banner Image URL")
			.setDesc(
				"Paste a direct image link. Leave empty to clear the banner and fall back to the default.",
			)
			.addText((text) =>
				text
					.setPlaceholder("https://...")
					.setValue(this.currentUrl)
					.onChange((value) => {
						previewUrl = value.trim();
						renderPreview();
					}),
			);

		const footerBtnRow = contentEl.createDiv({
			attr: {
				style: "display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px;",
			},
		});
		const cancelBtn = footerBtnRow.createEl("button", { text: "Cancel" });
		cancelBtn.addEventListener("click", () => this.close());

		const saveBtn = footerBtnRow.createEl("button", {
			text: "Save",
			cls: "mod-cta",
		});
		saveBtn.addEventListener("click", () => {
			this.onConfirm(previewUrl.trim());
			this.close();
		});
	}

	onClose() {
		this.contentEl.empty();
	}
}