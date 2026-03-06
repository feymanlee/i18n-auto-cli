/*
 * @Date: 2025-03-31 19:05:57
 * @LastEditors: xiaoshan
 * @LastEditTime: 2025-03-31 19:52:10
 * @FilePath: /i18n_translation_vite/packages/autoI18nPluginCore/src/translator/scan.ts
 */
import { Translator, TranslatorOption } from './translator/Translator';

/**
 * 空翻译器，不翻译文本，用于配合某些特殊的操作
 */
export class EmptyTranslator extends Translator {
    constructor(option: Partial<TranslatorOption> = {}) {
        const resultOption: TranslatorOption = {
            name: '空翻译器',
            fetchMethod: async (jsonObj: Record<string, string>, _from: string, _to: string): Promise<Record<string, string>> => {
                // 翻译结果统一设置为空串
                const result: Record<string, string> = {};
                for (const key in jsonObj) {
                    result[key] = '';
                }
                return result;
            },
            ...option
        };
        super(resultOption);
    }
}