// 代码灵感来自https://github.com/dadidi9900/auto-plugins-json-translate/blob/main/src/services/translationService.ts
import axios, { AxiosProxyConfig } from 'axios'
import { Translator } from './translator/Translator'

export interface VolcengineTranslatorOption {
    apiKey: string
    /** 使用的ai模型，可选值请参阅火山引擎控制台的模型列表，如`doubao-1-5-pro-32k-250115`，并请确保使用前已在控制台开通了对应模型 */
    model: string
    /** 对本项目的简短描述，在有描述的情况下大模型的翻译结果可能会更加准确 */
    desc?: string
    /** 网络代理配置 */
    proxy?: AxiosProxyConfig
    /** 翻译api执行间隔，默认为1000 */
    interval?: number
    insertOption?: {
        [key: string]: any
    }
}

/**
 * 火山引擎翻译器，内置豆包、deepseek等模型
 * 
 * 火山引擎大模型介绍：https://www.volcengine.com/docs/82379/1099455
 * 
 * api文档：https://www.volcengine.com/docs/82379/1298454
 * 
 * 使用方式：
 * ```ts
 * vitePluginsAutoI18n({
    ...
    translator: new VolcengineTranslator({
        apiKey: '你申请的apiKey',
        model: '你要调用的模型，如：`doubao-1-5-pro-32k-250115`，请确保使用前已在控制台开通了对应模型'
    })
})
 * ```
 */
export class VolcengineTranslator extends Translator {
    private readonly CHUNK_SIZE = 50;

    constructor(option: VolcengineTranslatorOption) {
        super({
            name: '火山引擎ai翻译',
            fetchMethod: async (jsonObj, fromKey, toKey) => {
                // 将 jsonObj 拆分成 50 个一组
                const entries = Object.entries(jsonObj);
                const chunks: Record<string, string>[] = [];
                for (let i = 0; i < entries.length; i += this.CHUNK_SIZE) {
                    const chunk: Record<string, string> = {};
                    for (let j = i; j < i + this.CHUNK_SIZE && j < entries.length; j++) {
                        chunk[entries[j][0]] = entries[j][1];
                    }
                    chunks.push(chunk);
                }

                // 并行翻译每个 chunk
                const promises = chunks.map((chunk) => this.translateChunk(chunk, fromKey, toKey, option));
                const results = await Promise.all(promises);

                // 合并结果
                const mergedResult: Record<string, string> = {};
                for (const result of results) {
                    Object.assign(mergedResult, result);
                }

                return mergedResult;
            },
            onError: (error, cb) => {
                cb(error)
                console.error(
                    '请确保在火山引擎控制台开通了对应模型，且有足够的token余额。控制台地址：https://console.volcengine.com/ark/'
                )
            },
            maxChunkSize: 1000,
            interval: option.interval ?? 0
        })
    }

    private async translateChunk(
        sourceMap: Record<string, string>,
        fromKey: string,
        toKey: string,
        option: VolcengineTranslatorOption
    ): Promise<Record<string, string>> {
        let salt = new Date().getTime();

        const data = {
            model: option.model,
            messages: [
                {
                    role: 'system',
                    content: `
                        ###
                        假如你是一个无情的翻译接口，你将根据一个文本组成的JSON对象，来解决将数组每个成员从源语言A翻译成目标语言B并返回翻译后的JSON对象的任务。需要注意的是，待翻译的文本均来自一个${option.desc ? option.desc + '的' : ''}web平台，遇到歧义时需要做好处理。根据以下规则一步步执行：
                        1. 明确源语言A和目标语言B。
                        2. 对JSON对象中数组的每个成员进行从源语言A到目标语言B的翻译。
                        3. 将翻译后的内容以JSON对象格式返回，确保返回的内容可以被JSON.parse解析。

                        参考例子：
                        示例1：
                        输入：zh-cn -> en { "awfgx": "你好", "qwfga": "世界" }
                        输出：{ "awfgx": "Hello", "qwfga": "World" }

                        示例2：
                        输入：de -> fr { "gweaq": "Hallo", "wtrts": "Welt" }
                        输出：{ "gweaq": "Bonjour", "wtrts": "Monde" }

                        请回答问题：
                        输入：源语言A -> 目标语言B { "wghhj": "XXX" }
                        输出：

                        要求：
                        1 以JSON对象格式输出
                        2 JSON对象中每个成员为翻译后的内容
                        ###
                    `
                },
                {
                    role: 'user',
                    content: `${fromKey} -> ${toKey} ${JSON.stringify(sourceMap)}`
                }
            ],
            ...(option.insertOption || {})
        };

        try {
            const response = await axios.post(
                `https://ark.cn-beijing.volces.com/api/v3/chat/completions?t=${salt}`,
                data,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${option.apiKey}`
                    },
                    proxy: option.proxy
                }
            );

            const content = response.data.choices[0].message.content;
            let resultMap: Record<string, string>;

            try {
                resultMap = JSON.parse(content);
            } catch (parseError) {
                console.warn(`⚠ JSON 解析失败，返回内容: ${content.substring(0, 200)}...`);
                throw new Error('大模型返回文本解析失败');
            }

            if (typeof resultMap !== 'object' || !resultMap) {
                throw new Error('大模型返回文本解析后类型不正确');
            }

            // 验证返回的 key 是否包含所有源 key
            const sourceKeys = Object.keys(sourceMap);
            const resultKeys = Object.keys(resultMap);
            const missingKeys = sourceKeys.filter(key => !(key in resultMap));

            if (missingKeys.length > 0) {
                console.warn(`⚠ 大模型返回文本缺少以下 ${missingKeys.length} 个 key: ${missingKeys.join(', ')}`);
                console.warn(`⚠ 源 key 数量: ${sourceKeys.length}, 返回 key 数量: ${resultKeys.length}`);
                for (const key of missingKeys) {
                    resultMap[key] = sourceMap[key];
                }
            }

            return resultMap;
        } catch (error) {
            const message = error instanceof Error ? error.message : '未知错误';
            console.warn(`⚠ 批次翻译失败: ${message}`);
            console.warn('⚠ 原文本内容：', JSON.stringify(sourceMap));
            return sourceMap;
        }
    }
}