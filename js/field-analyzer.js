/**
 * 客户信息分析器 - 从自然语言文本中提取结构化客户信息
 * 并将其智能匹配到 PDF 表单字段
 */
class FieldAnalyzer {
    constructor() {
        // 定义常见的客户信息模式（正则表达式）
        this.patterns = {
            name: {
                label: '姓名',
                regex: [
                    /(?:姓名|名字|名称|客户名?|甲方|本人)\s*[：:]\s*([^\s,，、;；\n]+)/,
                    /(?:name)\s*[：:]\s*([^\s,，;；\n]+(?:\s+[^\s,，;；\n]+)*)/i,
                ],
                fieldNames: ['name', 'fullname', 'full_name', 'customer_name', 'client_name',
                    'applicant', 'applicant_name', '姓名', '名字', '客户姓名', '甲方',
                    'xingming', 'xm', 'Name', 'FullName', 'CustomerName']
            },
            lastName: {
                label: '姓',
                regex: [
                    /(?:姓氏?|last\s*name|surname)\s*[：:]\s*([^\s,，、;；\n]+)/i,
                ],
                fieldNames: ['lastname', 'last_name', 'surname', 'family_name', '姓', '姓氏',
                    'LastName', 'FamilyName']
            },
            firstName: {
                label: '名',
                regex: [
                    /(?:名|first\s*name|given\s*name)\s*[：:]\s*([^\s,，、;；\n]+)/i,
                ],
                fieldNames: ['firstname', 'first_name', 'given_name', 'givenname', '名',
                    'FirstName', 'GivenName']
            },
            phone: {
                label: '电话',
                regex: [
                    /(?:电话|手机|联系电话|手机号|电话号码?|tel|phone|mobile)\s*[：:]\s*([\d\-+() ]+)/i,
                    /(?<![.\d])(1[3-9]\d{9})(?!\d)/,
                    /(?<![.\d])(\d{3,4}[-\s]?\d{7,8})(?!\d)/,
                ],
                fieldNames: ['phone', 'telephone', 'tel', 'mobile', 'phone_number', 'cell',
                    '电话', '手机', '联系电话', 'Phone', 'Telephone', 'Mobile', 'CellPhone']
            },
            email: {
                label: '邮箱',
                regex: [
                    /(?:邮箱|邮件|电子邮[箱件]|email|e-mail)\s*[：:]\s*([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i,
                    /([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/,
                ],
                fieldNames: ['email', 'e-mail', 'email_address', 'mail', '邮箱', '电子邮箱',
                    'Email', 'EmailAddress', 'E-mail']
            },
            idCard: {
                label: '身份证号',
                regex: [
                    /(?:身份证[号码]*|ID[号码]*|证件号[码]?)\s*[：:]\s*([1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx])/i,
                    /(?<!\d)([1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx])(?!\d)/,
                ],
                fieldNames: ['id', 'id_card', 'id_number', 'identity', 'idcard', 'idnumber',
                    '身份证', '身份证号', '证件号', 'IDCard', 'IDNumber', 'IdentityNumber']
            },
            address: {
                label: '地址',
                regex: [
                    /(?:地址|住址|通讯地址|联系地址|居住地址?|address)\s*[：:]\s*([^\n;；]{5,})/i,
                ],
                fieldNames: ['address', 'addr', 'full_address', 'home_address', 'mailing_address',
                    '地址', '住址', '通讯地址', 'Address', 'HomeAddress', 'MailingAddress',
                    'street', 'Street']
            },
            city: {
                label: '城市',
                regex: [
                    /(?:城市|所在城市|city)\s*[：:]\s*([^\s,，、;；\n]+)/i,
                ],
                fieldNames: ['city', '城市', 'City']
            },
            province: {
                label: '省份',
                regex: [
                    /(?:省份?|state|province)\s*[：:]\s*([^\s,，、;；\n]+)/i,
                ],
                fieldNames: ['province', 'state', '省', '省份', 'Province', 'State']
            },
            zipCode: {
                label: '邮编',
                regex: [
                    /(?:邮编|邮政编码|zip\s*code?|postal\s*code?)\s*[：:]\s*(\d{5,6})/i,
                ],
                fieldNames: ['zip', 'zipcode', 'zip_code', 'postal', 'postal_code', 'postcode',
                    '邮编', '邮政编码', 'ZipCode', 'PostalCode']
            },
            company: {
                label: '公司',
                regex: [
                    /(?:公司|单位|企业|组织|机构|company|organization|org)\s*[：:]\s*([^\n;；,，]{2,})/i,
                    /([^\s,，;；\n]*(?:有限公司|股份公司|集团|科技|信息技术|网络)[^\s,，;；\n]*)/,
                ],
                fieldNames: ['company', 'organization', 'org', 'company_name', 'employer',
                    '公司', '单位', '公司名称', 'Company', 'CompanyName', 'Organization']
            },
            date: {
                label: '日期',
                regex: [
                    /(?:日期|签署日期|date)\s*[：:]\s*(\d{4}[\-/年.]\d{1,2}[\-/月.]\d{1,2}日?)/i,
                ],
                fieldNames: ['date', 'sign_date', 'signature_date', '日期', '签署日期',
                    'Date', 'SignDate', 'CurrentDate']
            },
            gender: {
                label: '性别',
                regex: [
                    /(?:性别|gender|sex)\s*[：:]\s*(男|女|male|female)/i,
                ],
                fieldNames: ['gender', 'sex', '性别', 'Gender', 'Sex']
            },
            birthday: {
                label: '出生日期',
                regex: [
                    /(?:出生日期|生日|出生年月|birth\s*(?:day|date)?)\s*[：:]\s*(\d{4}[\-/年.]\d{1,2}[\-/月.]?\d{0,2}日?)/i,
                ],
                fieldNames: ['birthday', 'birth_date', 'birthdate', 'dob', 'date_of_birth',
                    '出生日期', '生日', 'Birthday', 'BirthDate', 'DOB', 'DateOfBirth']
            },
            nationality: {
                label: '国籍',
                regex: [
                    /(?:国籍|民族|nationality)\s*[：:]\s*([^\s,，、;；\n]+)/i,
                ],
                fieldNames: ['nationality', 'nation', '国籍', '民族', 'Nationality']
            },
            occupation: {
                label: '职业',
                regex: [
                    /(?:职业|职务|岗位|occupation|job|title|position)\s*[：:]\s*([^\s,，、;；\n]+)/i,
                ],
                fieldNames: ['occupation', 'job', 'job_title', 'position', 'title',
                    '职业', '职务', 'Occupation', 'JobTitle', 'Position']
            },
            bankAccount: {
                label: '银行账号',
                regex: [
                    /(?:银行账[号户]|账[号户]|bank\s*account)\s*[：:]\s*([\d\s\-]+)/i,
                ],
                fieldNames: ['bank_account', 'account_number', 'account', '银行账号', '账号',
                    'BankAccount', 'AccountNumber']
            },
            bankName: {
                label: '开户行',
                regex: [
                    /(?:开户行|开户银行|银行名称|bank\s*name?)\s*[：:]\s*([^\n;；,，]+)/i,
                ],
                fieldNames: ['bank_name', 'bank', '开户行', '银行', 'BankName', 'Bank']
            },
        };
    }

    /**
     * 从自然语言文本中提取客户信息
     */
    extractCustomerInfo(text) {
        const extracted = {};

        for (const [key, config] of Object.entries(this.patterns)) {
            for (const regex of config.regex) {
                const match = text.match(regex);
                if (match && match[1]) {
                    extracted[key] = match[1].trim();
                    break;
                }
            }
        }

        // 尝试从身份证号提取额外信息
        if (extracted.idCard && !extracted.birthday) {
            const id = extracted.idCard;
            if (id.length === 18) {
                const year = id.substring(6, 10);
                const month = id.substring(10, 12);
                const day = id.substring(12, 14);
                extracted.birthday = `${year}-${month}-${day}`;
            }
        }

        if (extracted.idCard && !extracted.gender) {
            const id = extracted.idCard;
            if (id.length === 18) {
                const genderCode = parseInt(id.charAt(16));
                extracted.gender = genderCode % 2 === 1 ? '男' : '女';
            }
        }

        return extracted;
    }

    /**
     * 将提取的客户信息匹配到 PDF 表单字段
     */
    matchFieldsToInfo(pdfFields, customerInfo) {
        const mappings = [];

        for (const field of pdfFields) {
            const fieldName = field.name || '';
            const fieldNameLower = fieldName.toLowerCase().replace(/[\s_\-\.]/g, '');
            let matchedValue = '';
            let matchedKey = '';
            let confidence = 0;

            // 尝试匹配每个信息类型
            for (const [key, config] of Object.entries(this.patterns)) {
                if (!customerInfo[key]) continue;

                // 检查字段名是否与已知的字段名列表匹配
                for (const knownName of config.fieldNames) {
                    const knownNameClean = knownName.toLowerCase().replace(/[\s_\-\.]/g, '');
                    if (fieldNameLower === knownNameClean ||
                        fieldNameLower.includes(knownNameClean) ||
                        knownNameClean.includes(fieldNameLower)) {
                        if (knownNameClean.length > confidence) {
                            matchedValue = customerInfo[key];
                            matchedKey = key;
                            confidence = knownNameClean.length;
                        }
                    }
                }

                // 模糊匹配：检查字段名是否包含信息类型的关键词
                const label = config.label;
                if (fieldName.includes(label) || fieldNameLower.includes(label)) {
                    if (label.length > confidence) {
                        matchedValue = customerInfo[key];
                        matchedKey = key;
                        confidence = label.length;
                    }
                }
            }

            mappings.push({
                fieldName: field.name,
                fieldType: field.type,
                currentValue: field.value || '',
                matchedValue: matchedValue,
                matchedKey: matchedKey,
                isMatched: matchedValue !== '',
                options: field.options || null,
            });
        }

        return mappings;
    }

    /**
     * 获取信息类型的中文标签
     */
    getLabelForKey(key) {
        return this.patterns[key]?.label || key;
    }

    /**
     * 获取所有已定义的信息类型
     */
    getInfoTypes() {
        return Object.entries(this.patterns).map(([key, config]) => ({
            key,
            label: config.label,
        }));
    }
}
