/**
 * 应用主逻辑 - 管理 UI 交互和流程控制
 */
(function () {
    'use strict';

    const analyzer = new FieldAnalyzer();
    const pdfHandler = new PdfHandler();

    // 状态
    let currentMappings = [];
    let uploadedFileName = '';
    let currentPreviewPage = 1;

    // DOM 元素
    const uploadArea = document.getElementById('upload-area');
    const pdfInput = document.getElementById('pdf-input');
    const fileInfo = document.getElementById('file-info');
    const fileNameDisplay = document.getElementById('file-name');
    const btnRemoveFile = document.getElementById('btn-remove-file');

    const stepInfo = document.getElementById('step-info');
    const customerInfoInput = document.getElementById('customer-info-input');
    const btnAnalyze = document.getElementById('btn-analyze');

    const stepMapping = document.getElementById('step-mapping');
    const fieldList = document.getElementById('field-list');
    const btnReset = document.getElementById('btn-reset');
    const btnFill = document.getElementById('btn-fill');

    const stepPreview = document.getElementById('step-preview');
    const pdfPreviewCanvas = document.getElementById('pdf-preview');
    const btnPrevPage = document.getElementById('btn-prev-page');
    const btnNextPage = document.getElementById('btn-next-page');
    const pageInfo = document.getElementById('page-info');
    const btnBackEdit = document.getElementById('btn-back-edit');
    const btnDownload = document.getElementById('btn-download');

    // ---- 文件上传 ----

    uploadArea.addEventListener('click', () => pdfInput.click());

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type === 'application/pdf') {
            handleFileUpload(files[0]);
        }
    });

    pdfInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
        }
    });

    btnRemoveFile.addEventListener('click', () => {
        resetAll();
    });

    async function handleFileUpload(file) {
        showLoading('正在加载 PDF 文件...');

        try {
            const result = await pdfHandler.loadPdf(file);
            uploadedFileName = result.fileName;

            // 更新 UI
            fileNameDisplay.textContent = `${result.fileName} (${result.pageCount} 页)`;
            fileInfo.style.display = 'flex';
            uploadArea.style.display = 'none';

            // 检测表单字段
            const fields = pdfHandler.getFormFields();

            if (fields.length === 0) {
                hideLoading();
                alert('此 PDF 文件中未检测到可填写的表单字段。请确保上传的是带有表单字段的 PDF 文件。');
                return;
            }

            // 显示下一步
            stepInfo.style.display = 'block';
            stepInfo.scrollIntoView({ behavior: 'smooth', block: 'start' });

            hideLoading();
        } catch (err) {
            hideLoading();
            alert(err.message);
            resetAll();
        }
    }

    // ---- 分析客户信息 ----

    btnAnalyze.addEventListener('click', () => {
        const text = customerInfoInput.value.trim();
        if (!text) {
            alert('请先输入客户信息');
            return;
        }

        showLoading('正在分析客户信息...');

        // 提取客户信息
        const customerInfo = analyzer.extractCustomerInfo(text);
        const fields = pdfHandler.getFormFields();

        // 匹配字段
        currentMappings = analyzer.matchFieldsToInfo(fields, customerInfo);

        // 渲染字段映射 UI
        renderFieldMappings(currentMappings, customerInfo);

        stepMapping.style.display = 'block';
        hideLoading();
        stepMapping.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    function renderFieldMappings(mappings, customerInfo) {
        fieldList.innerHTML = '';

        // 显示提取到的信息摘要
        const extractedKeys = Object.keys(customerInfo);
        if (extractedKeys.length > 0) {
            const summary = document.createElement('div');
            summary.className = 'extracted-summary';
            summary.style.cssText = 'background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 16px;margin-bottom:16px;';
            const items = extractedKeys.map(key =>
                `<strong>${analyzer.getLabelForKey(key)}:</strong> ${customerInfo[key]}`
            ).join(' | ');
            summary.innerHTML = `<div style="font-size:0.85rem;color:#166534;margin-bottom:4px;font-weight:600;">已识别的客户信息：</div><div style="font-size:0.9rem;color:#15803d;line-height:1.8;">${items}</div>`;
            fieldList.appendChild(summary);
        }

        for (let i = 0; i < mappings.length; i++) {
            const mapping = mappings[i];

            // 跳过按钮和签名字段
            if (mapping.fieldType === 'button' || mapping.fieldType === 'signature') continue;

            const row = document.createElement('div');
            row.className = `field-row ${mapping.isMatched ? 'matched' : 'unmatched'}`;

            if (mapping.fieldType === 'checkbox') {
                row.classList.add('checkbox-field');
                row.innerHTML = `
                    <div class="field-label">
                        ${escapeHtml(mapping.fieldName)}
                        <span class="field-type-badge">复选框</span>
                    </div>
                    <div class="field-arrow">&rarr;</div>
                    <input type="checkbox" class="field-checkbox-input" data-index="${i}"
                        ${(mapping.matchedValue === 'true' || mapping.currentValue === 'true') ? 'checked' : ''}>
                `;
            } else if (mapping.fieldType === 'dropdown' || mapping.fieldType === 'radio' || mapping.fieldType === 'optionlist') {
                const options = mapping.options || [];
                const selectedValue = mapping.matchedValue || mapping.currentValue || '';
                row.innerHTML = `
                    <div class="field-label">
                        ${escapeHtml(mapping.fieldName)}
                        <span class="field-type-badge">${mapping.fieldType === 'dropdown' ? '下拉' : mapping.fieldType === 'radio' ? '单选' : '列表'}</span>
                    </div>
                    <div class="field-arrow">&rarr;</div>
                    <select class="field-value-input" data-index="${i}">
                        <option value="">-- 请选择 --</option>
                        ${options.map(opt =>
                            `<option value="${escapeHtml(opt)}" ${opt === selectedValue ? 'selected' : ''}>${escapeHtml(opt)}</option>`
                        ).join('')}
                    </select>
                `;
            } else {
                row.innerHTML = `
                    <div class="field-label">
                        ${escapeHtml(mapping.fieldName)}
                        <span class="field-type-badge">文本</span>
                    </div>
                    <div class="field-arrow">&rarr;</div>
                    <input type="text" class="field-value-input" data-index="${i}"
                        value="${escapeHtml(mapping.matchedValue || mapping.currentValue)}"
                        placeholder="输入值...">
                `;
            }

            fieldList.appendChild(row);
        }
    }

    // ---- 填充 PDF ----

    btnFill.addEventListener('click', async () => {
        showLoading('正在填充 PDF 表单...');

        // 从 UI 读取用户修改后的值
        const inputs = fieldList.querySelectorAll('[data-index]');
        inputs.forEach(input => {
            const idx = parseInt(input.dataset.index);
            if (input.type === 'checkbox') {
                currentMappings[idx].userValue = input.checked ? 'true' : 'false';
            } else {
                currentMappings[idx].userValue = input.value;
            }
        });

        try {
            const filledBytes = await pdfHandler.fillForm(currentMappings);

            // 渲染预览
            currentPreviewPage = 1;
            await renderPreview(filledBytes, currentPreviewPage);

            stepPreview.style.display = 'block';
            hideLoading();
            stepPreview.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (err) {
            hideLoading();
            alert('填充 PDF 时出错：' + err.message);
        }
    });

    async function renderPreview(pdfData, pageNumber) {
        const result = await pdfHandler.renderPage(pdfPreviewCanvas, pdfData, pageNumber);
        pageInfo.textContent = `第 ${result.currentPage} 页 / 共 ${result.totalPages} 页`;
        btnPrevPage.disabled = result.currentPage <= 1;
        btnNextPage.disabled = result.currentPage >= result.totalPages;
    }

    // ---- 翻页 ----

    btnPrevPage.addEventListener('click', async () => {
        if (currentPreviewPage > 1) {
            currentPreviewPage--;
            await renderPreview(pdfHandler.filledPdfBytes, currentPreviewPage);
        }
    });

    btnNextPage.addEventListener('click', async () => {
        if (currentPreviewPage < pdfHandler.totalPages) {
            currentPreviewPage++;
            await renderPreview(pdfHandler.filledPdfBytes, currentPreviewPage);
        }
    });

    // ---- 下载 ----

    btnDownload.addEventListener('click', () => {
        pdfHandler.downloadFilledPdf(uploadedFileName);
    });

    // ---- 返回修改 ----

    btnBackEdit.addEventListener('click', () => {
        stepPreview.style.display = 'none';
        stepMapping.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // ---- 重置 ----

    btnReset.addEventListener('click', () => {
        customerInfoInput.value = '';
        currentMappings = [];
        fieldList.innerHTML = '';
        stepMapping.style.display = 'none';
        stepPreview.style.display = 'none';
        stepInfo.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    function resetAll() {
        pdfInput.value = '';
        uploadedFileName = '';
        currentMappings = [];
        fileInfo.style.display = 'none';
        uploadArea.style.display = '';
        stepInfo.style.display = 'none';
        stepMapping.style.display = 'none';
        stepPreview.style.display = 'none';
        customerInfoInput.value = '';
        fieldList.innerHTML = '';
    }

    // ---- 工具函数 ----

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function showLoading(text) {
        let overlay = document.querySelector('.loading-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'loading-overlay';
            overlay.innerHTML = `
                <div class="loading-spinner">
                    <div class="spinner"></div>
                    <div class="loading-text"></div>
                </div>
            `;
            document.body.appendChild(overlay);
        }
        overlay.querySelector('.loading-text').textContent = text || '处理中...';
        overlay.style.display = 'flex';
    }

    function hideLoading() {
        const overlay = document.querySelector('.loading-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }
})();
