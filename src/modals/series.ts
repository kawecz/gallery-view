import { App, Modal, Setting } from "obsidian";
import { searchTMDBSeries, type SeriesMetadata } from "../importers/series";

export class SeriesModal extends Modal {
    private onConfirm: (series: SeriesMetadata) => void;
    private apiKey: string;

    constructor(
        app: App,
        apiKey: string,
        onConfirm: (series: SeriesMetadata) => void,
    ) {
        super(app);
        this.onConfirm = onConfirm;
        this.apiKey = apiKey;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h3", {
            text: "📺 Import Series from TMDB",
            attr: { style: "margin-top: 0;" },
        });

        if (!this.apiKey) {
            contentEl.createDiv({
                text: "Please set your TMDB API key in the plugin settings first.",
                attr: {
                    style: "text-align: center; padding: 20px; color: var(--text-error);",
                },
            });

            const footerBtnRow = contentEl.createDiv({
                attr: {
                    style: "display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px;",
                },
            });
            const closeBtn = footerBtnRow.createEl("button", { text: "Close" });
            closeBtn.addEventListener("click", () => this.close());
            return;
        }

        let searchQuery = "";
        const resultsContainer = contentEl.createDiv({
            cls: "gallery-series-results",
        });

        new Setting(contentEl)
            .setName("Search Series")
            .addText((text) =>
                text
                    .setPlaceholder("e.g., Breaking Bad, Stranger Things")
                    .onChange((value) => {
                        searchQuery = value;
                    }),
            )
            .addButton((btn) =>
                btn
                    .setButtonText("Search")
                    .setCta()
                    .onClick(() => {
                        void (async () => {
                            if (!searchQuery.trim()) return;
                            resultsContainer.empty();
                            resultsContainer.createDiv({
                                text: "Searching...",
                                attr: {
                                    style: "text-align: center; padding: 20px; color: var(--text-muted);",
                                },
                            });

                            try {
                                const results = await searchTMDBSeries(
                                    searchQuery.trim(),
                                    this.apiKey,
                                );
                                resultsContainer.empty();

                                if (results.length === 0) {
                                    resultsContainer.createDiv({
                                        text: "No series found.",
                                        attr: {
                                            style: "text-align: center; padding: 20px; color: var(--text-muted);",
                                        },
                                    });
                                    return;
                                }

                                results.forEach((series) => {
                                    const seriesItem = resultsContainer.createDiv({
                                        cls: "gallery-series-result-item",
                                    });
                                    seriesItem.setCssProps({
                                        display: "flex",
                                        gap: "12px",
                                        padding: "10px",
                                        border: "1px solid var(--background-modifier-border)",
                                        borderRadius: "8px",
                                        marginBottom: "8px",
                                        cursor: "pointer",
                                        transition: "all 0.2s ease",
                                    });

                                    if (series.coverUrl) {
                                        const poster = seriesItem.createDiv({
                                            attr: {
                                                style: "width: 50px; height: 75px; flex-shrink: 0; border-radius: 4px; overflow: hidden;",
                                            },
                                        });
                                        poster.createEl("img", {
                                            attr: {
                                                src: series.coverUrl,
                                                style: "width: 100%; height: 100%; object-fit: cover;",
                                            },
                                        });
                                    }

                                    const info = seriesItem.createDiv({
                                        attr: { style: "flex: 1;" },
                                    });
                                    info.createEl("strong", {
                                        text: series.title,
                                        attr: { style: "display: block; margin-bottom: 4px;" },
                                    });
                                    const subInfo: string[] = [];
                                    if (series.year) subInfo.push(series.year);
                                    if (series.seasons)
                                        subInfo.push(
                                            `${series.seasons} season${series.seasons === "1" ? "" : "s"}`,
                                        );
                                    if (series.rating)
                                        subInfo.push(`⭐ ${series.rating}`);
                                    if (subInfo.length > 0) {
                                        info.createEl("div", {
                                            text: subInfo.join(" · "),
                                            attr: {
                                                style: "font-size: 0.85em; color: var(--text-muted);",
                                            },
                                        });
                                    }

                                    seriesItem.addEventListener("click", () => {
                                        this.onConfirm(series);
                                        this.close();
                                    });

                                    seriesItem.addEventListener("mouseenter", () => {
                                        seriesItem.setCssProps({
                                            background: "var(--background-modifier-hover)",
                                            borderColor: "var(--interactive-accent)",
                                        });
                                    });
                                    seriesItem.addEventListener("mouseleave", () => {
                                        seriesItem.setCssProps({
                                            background: "",
                                            borderColor: "var(--background-modifier-border)",
                                        });
                                    });
                                });
                            } catch {
                                resultsContainer.empty();
                                resultsContainer.createDiv({
                                    text: "Failed to search. Check your API key and try again.",
                                    attr: {
                                        style: "text-align: center; padding: 20px; color: var(--text-error);",
                                    },
                                });
                            }
                        })();
                    }),
            );

        const footerBtnRow = contentEl.createDiv({
            attr: {
                style: "display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px;",
            },
        });
        const cancelBtn = footerBtnRow.createEl("button", { text: "Cancel" });
        cancelBtn.addEventListener("click", () => this.close());
    }

    onClose() {
        this.contentEl.empty();
    }
}