/*
 * @Date: 2025-03-11 17:53:11
 * @LastEditors: xiaoshan
 * @LastEditTime: 2025-03-14 14:21:06
 * @FilePath: /i18n_translation_vite/packages/autoI18nPluginCore/src/translator/google.ts
 */
import { translate } from '@vitalets/google-translate-api';
import { Translator } from './translator/Translator';
import tunnel from 'tunnel';

export interface GoogleTranslatorOption {
    proxyOption?: tunnel.ProxyOptions;
    /** 翻译api执行间隔，默认为1000 */
    interval?: number;
    insertOption?: {
        [key: string]: any;
    };
}

export interface GoogleTranslatorOption {
    proxyOption?: tunnel.ProxyOptions
    /** 翻译api执行间隔，默认为1000 */
    interval?: number
    insertOption?: {
        [key: string]: any
    }
}

/**
 * 谷歌翻译器
 *
 * 基于@vitalets/google-translate-api，需要翻墙，不稳定，但是免费
 *
 * 使用方式：
 * ```ts
 * vitePluginsAutoI18n({
    ...
    translator: translator: new GoogleTranslator({
        proxyOption: {
            // 如果你本地的代理在127.0.0.0:8899
            host: '127.0.0.1',
            port: 8899,
            headers: {
                'User-Agent': 'Node'
            }
        }
    })
})
 * ```
 */
export class GoogleTranslator extends Translator {
    constructor(option: GoogleTranslatorOption = {}) {
        super({
            name: 'Google翻译',
            fetchMethod: async (jsonObj, fromKey, toKey) => {
                const result: Record<string, string> = {};
                for (const key in jsonObj) {
                    try {
                        const data = await translate(jsonObj[key], {
                            from: fromKey,
                            to: toKey,
                            ...(option.proxyOption
                                ? {
                                      fetchOptions: {
                                          agent: tunnel.httpsOverHttp({
                                              proxy: option.proxyOption
                                          })
                                      }
                                  }
                                : {}),
                            ...(option.insertOption || {})
                        });
                        result[key] = data['text'] || jsonObj[key];
                    } catch (error) {
                        console.error(`Google翻译失败 [${key}]: ${jsonObj[key]}`, error);
                        result[key] = jsonObj[key];
                    }
                }
                return result;
            },
            onError: (error, cb) => {
                cb(error)
                if (error instanceof Object && 'code' in error && error.code === 'ETIMEDOUT') {
                    console.error('❗ 请求超时，请确保你的网络可以访问google ❗')
                }
            },
            interval: option.interval ?? 1000
        })
    }
}