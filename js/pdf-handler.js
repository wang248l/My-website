/**
 * PDF 处理器 - 负责 PDF 的加载、字段提取、填充和预览
 */
class PdfHandler {
    constructor() {
        this.pdfBytes = null;
        this.pdfDoc = null;       // pdf-lib document
        this.filledPdfBytes = null;
        this.renderDoc = null;    // pdf.js document for rendering
        this.currentPage = 1;
        this.totalPages = 0;
        this.fontBytes = null;

        // 配置 pdf.js worker
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc =
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
    }

    /**
     * 加载 PDF 文件
     */
    async loadPdf(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    this.pdfBytes = new Uint8Array(e.target.result);
                    this.pdfDoc = await PDFLib.PDFDocument.load(this.pdfBytes, {
                        ignoreEncryption: true,
                    });

                    // 注册 fontkit 以支持中文字体
                    this.pdfDoc.registerFontkit(fontkit);

                    this.totalPages = this.pdfDoc.getPageCount();
                    resolve({
                        pageCount: this.totalPages,
                        fileName: file.name,
                    });
                } catch (err) {
                    reject(new Error('无法加载 PDF 文件：' + err.message));
                }
            };
            reader.onerror = () => reject(new Error('文件读取失败'));
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * 加载中文字体
     */
    async loadChineseFont() {
        if (this.fontBytes) return this.fontBytes;

        // 尝试加载 Noto Sans SC 作为中文字体
        const fontUrls = [
            'https://cdn.jsdelivr.net/gh/AnastasiiaSchworworthy/fonts@main/NotoSansSC-Regular.otf',
            'https://fonts.gstatic.com/s/notosanssc/v36/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_FnYw.woff2',
        ];

        for (const url of fontUrls) {
            try {
                const response = await fetch(url);
                if (response.ok) {
                    this.fontBytes = await response.arrayBuffer();
                    return this.fontBytes;
                }
            } catch {
                // Try next URL
            }
        }

        return null;
    }

    /**
     * 获取 PDF 中的所有表单字段
     */
    getFormFields() {
        if (!this.pdfDoc) return [];

        const form = this.pdfDoc.getForm();
        const fields = form.getFields();
        const result = [];

        for (const field of fields) {
            const fieldInfo = {
                name: field.getName(),
                type: this._getFieldType(field),
                value: '',
                options: null,
            };

            try {
                if (field instanceof PDFLib.PDFTextField) {
                    fieldInfo.value = field.getText() || '';
                } else if (field instanceof PDFLib.PDFCheckBox) {
                    fieldInfo.value = field.isChecked() ? 'true' : 'false';
                } else if (field instanceof PDFLib.PDFDropdown) {
                    fieldInfo.value = field.getSelected()?.[0] || '';
                    fieldInfo.options = field.getOptions();
                } else if (field instanceof PDFLib.PDFRadioGroup) {
                    fieldInfo.value = field.getSelected() || '';
                    fieldInfo.options = field.getOptions();
                } else if (field instanceof PDFLib.PDFOptionList) {
                    fieldInfo.value = field.getSelected()?.[0] || '';
                    fieldInfo.options = field.getOptions();
                }
            } catch {
                // Some fields may not have values
            }

            result.push(fieldInfo);
        }

        return result;
    }

    /**
     * 获取字段类型
     */
    _getFieldType(field) {
        if (field instanceof PDFLib.PDFTextField) return 'text';
        if (field instanceof PDFLib.PDFCheckBox) return 'checkbox';
        if (field instanceof PDFLib.PDFDropdown) return 'dropdown';
        if (field instanceof PDFLib.PDFRadioGroup) return 'radio';
        if (field instanceof PDFLib.PDFOptionList) return 'optionlist';
        if (field instanceof PDFLib.PDFSignature) return 'signature';
        if (field instanceof PDFLib.PDFButton) return 'button';
        return 'unknown';
    }

    /**
     * 用给定的映射填充 PDF 表单
     */
    async fillForm(mappings) {
        // 重新加载原始 PDF 以避免重复填充
        const pdfDoc = await PDFLib.PDFDocument.load(this.pdfBytes, {
            ignoreEncryption: true,
        });
        pdfDoc.registerFontkit(fontkit);

        // 尝试嵌入中文字体
        let chineseFont = null;
        try {
            const fontData = await this.loadChineseFont();
            if (fontData) {
                chineseFont = await pdfDoc.embedFont(fontData);
            }
        } catch {
            // Fall back to standard font
        }

        const form = pdfDoc.getForm();

        for (const mapping of mappings) {
            if (!mapping.matchedValue && !mapping.userValue) continue;
            const value = mapping.userValue || mapping.matchedValue;
            if (!value) continue;

            try {
                const field = form.getField(mapping.fieldName);

                if (field instanceof PDFLib.PDFTextField) {
                    if (chineseFont) {
                        field.updateAppearances(chineseFont);
                    }
                    field.setText(value);
                } else if (field instanceof PDFLib.PDFCheckBox) {
                    const boolVal = value === 'true' || value === '是' || value === 'yes' || value === '1';
                    if (boolVal) {
                        field.check();
                    } else {
                        field.uncheck();
                    }
                } else if (field instanceof PDFLib.PDFDropdown) {
                    try {
                        field.select(value);
                    } catch {
                        // Value may not be in options
                    }
                } else if (field instanceof PDFLib.PDFRadioGroup) {
                    try {
                        field.select(value);
                    } catch {
                        // Value may not be in options
                    }
                }
            } catch {
                // Field may not exist or may be read-only
            }
        }

        // 扁平化可选（让字段不可编辑）
        // form.flatten();

        this.filledPdfBytes = await pdfDoc.save();
        return this.filledPdfBytes;
    }

    /**
     * 渲染 PDF 页面到 canvas
     */
    async renderPage(canvas, pdfData, pageNumber) {
        const data = pdfData || this.pdfBytes;
        if (!data) return;

        const loadingTask = pdfjsLib.getDocument({ data: data.slice(0) });
        this.renderDoc = await loadingTask.promise;
        this.totalPages = this.renderDoc.numPages;

        const page = await this.renderDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.5 });

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        await page.render({
            canvasContext: ctx,
            viewport: viewport,
        }).promise;

        return {
            currentPage: pageNumber,
            totalPages: this.totalPages,
        };
    }

    /**
     * 下载已填充的 PDF
     */
    downloadFilledPdf(fileName) {
        if (!this.filledPdfBytes) return;

        const blob = new Blob([this.filledPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName.replace('.pdf', '') + '_已填充.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
