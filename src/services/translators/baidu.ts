/*
 * @Date: 2025-03-16 23:39:13
 * @LastEditors: xiaoshan
 * @LastEditTime: 2025-03-17 01:11:37
 * @FilePath: /i18n_translation_vite/packages/autoI18nPluginCore/src/translator/baidu.ts
 */
import axios, { AxiosProxyConfig } from 'axios';
import { Translator } from './translator/Translator';
import CryptoJS from 'crypto-js';

export interface BaiduTranslatorOption {
    appId: string;
    appKey: string;
    /** 网络代理配置 */
    proxy?: AxiosProxyConfig;
    /** 翻译api执行间隔，默认为1000 */
    interval?: number;
    insertOption?: {
        [key: string]: any;
    };
}

export interface BaiduTranslatorOption {
    appId: string
    appKey: string
    /** 网络代理配置 */
    proxy?: AxiosProxyConfig
    /** 翻译api执行间隔，默认为1000 */
    interval?: number
    insertOption?: {
        [key: string]: any
    }
}

/**
 * 百度翻译器
 * 
 * api文档：https://api.fanyi.baidu.com/product/113
 * 
 * 使用方式：
 * ```ts
 * vitePluginsAutoI18n({
    ...
    translator: new BaiduTranslator({
        appId: '你申请的appId',
        appKey: '你申请的appKey'
    })
})
 * ```
 */
export class BaiduTranslator extends Translator {
    /** 百度的语言类型映射不标准，需要手动控制 */
    protected readonly BAIDU_TRANSLATE_KEY_CONVERT_MAP: Record<string, string> = {
        'zh-cn': 'zh',
        ja: 'jp',
        ko: 'kor'
    }

    protected getTranslateKey(key: string) {
        return this.BAIDU_TRANSLATE_KEY_CONVERT_MAP[key] || key
    }

    constructor(option: BaiduTranslatorOption) {
        super({
            name: '百度翻译',
            fetchMethod: async (jsonObj, fromKey, toKey) => {
                const result: Record<string, string> = {};
                const keys = Object.keys(jsonObj);

                for (const key of keys) {
                    try {
                        const text = jsonObj[key];
                        let salt = new Date().getTime();

                        const data = {
                            q: text,
                            appid: option.appId,
                            from: this.getTranslateKey(fromKey),
                            to: this.getTranslateKey(toKey),
                            salt,
                            sign: CryptoJS.MD5(option.appId + text + salt + option.appKey).toString(),
                            ...(option.insertOption || {})
                        };
                        const response = await axios.post(
                            'https://fanyi-api.baidu.com/api/trans/vip/translate',
                            data,
                            {
                                headers: {
                                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
                                },
                                proxy: option.proxy
                            }
                        );
                        if (!response.data?.trans_result) {
                            console.error(
                                '百度翻译请求失败，请检查您的appId和appKey是否正确，或查看响应信息：',
                                response.data
                            );
                            result[key] = text;
                        } else {
                            const translated = response.data.trans_result[0]?.dst || text;
                            result[key] = translated;
                        }
                    } catch (error) {
                        console.error(`百度翻译失败 [${key}]: ${jsonObj[key]}`, error);
                        result[key] = jsonObj[key];
                    }
                }

                return result;
            },
            onError: (error, cb) => {
                cb(error)
                console.error(
                    '请前往百度翻译官方申请翻译key，每个月都有免费额度，并请检查额度是否充足。'
                )
            },
            interval: option.interval ?? 1000
        })
    }
}