/**
 * core/vocab.ts — task_type / characteristics 受控词表注入点
 *
 * OQ-002（spec/open-questions.md）：
 *   spec/frozen.md §2.1 只给了示例词表，完整清单由人工在 Acquisition 之前定稿。
 *   人工裁决（2026-09-27）：接受过渡方案——
 *     Phase 0 仅使用规格示例值；校验代码按「词表可配置注入」实现；
 *     不把示例词表硬编码固化为完整定义。
 *
 * 因此：本模块导出的 SPEC_EXAMPLE_VOCAB 只是默认注入值，不是完整受控词表。
 * 任何校验逻辑都必须通过 ControlledVocab 参数拿到词表，不得直接引用示例清单做终判。
 */

export interface ControlledVocab {
  /** spec/frozen.md §2.1 示例：ui_upgrade / bugfix / refactor / data_layer / test / doc */
  readonly task_type: readonly string[];
  /** spec/frozen.md §2.1 示例：multi_page / multi_file / shared_state / new_module
   *  （§3.1：contraindications 的受控词表同 characteristics） */
  readonly characteristics: readonly string[];
}

/**
 * 规格示例词表（非完整定义，OQ-002 过渡期默认值）。
 * 完整清单定稿后由人工替换/扩充注入值。
 */
export const SPEC_EXAMPLE_VOCAB: ControlledVocab = {
  task_type: ['ui_upgrade', 'bugfix', 'refactor', 'data_layer', 'test', 'doc'],
  characteristics: ['multi_page', 'multi_file', 'shared_state', 'new_module'],
};

export function isValidTaskType(vocab: ControlledVocab, value: string): boolean {
  return vocab.task_type.includes(value);
}

export function isValidCharacteristic(vocab: ControlledVocab, value: string): boolean {
  return vocab.characteristics.includes(value);
}
