import type { FormEvent, ReactElement } from "react";

export type StudioSupplementFormProps = {
  readOnly?: boolean;
  text: string;
  state: 'idle' | 'saving' | 'saved' | 'error';
  errorMessage: string | null;
  onChange: (text: string) => void;
  onSubmit: (text: string) => void;
};

export default function StudioSupplementForm({
  readOnly = false,
  text,
  state,
  errorMessage,
  onChange,
  onSubmit,
}: StudioSupplementFormProps): ReactElement {
  const isSaving = state === "saving";
  const isSaved = state === "saved";
  const hasError = state === "error";

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (readOnly || isSaving || !text.trim()) return;
    onSubmit(text);
  }

  return (
    <section className="studio-supplement-form" aria-label="补充学习记录表单">
      <div className="studio-supplement-form__header">
        <h2 className="studio-supplement-form__heading">补充学习记录</h2>
        <span className="studio-supplement-form__kicker">NATURAL LANGUAGE / 自然语言</span>
      </div>

      <p className="studio-supplement-form__desc">
        简要记录学习内容、实际练习或遇到的问题。内容仅保存在私人空间；学习时间和完成能力不会根据文字自动推断。
      </p>

      <form onSubmit={handleSubmit} className="studio-supplement-form__form">
        <label htmlFor="studio-supplement-input" className="studio-supplement-form__label">
          <span>记录内容</span>
          <span className="studio-supplement-form__label-hint">{readOnly ? '（只读预览，保存尚未开放）' : '（输入后提交保存）'}</span>
        </label>

        <textarea
          id="studio-supplement-input"
          className="studio-supplement-form__textarea"
          rows={4}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder="例如：C语言指针运算与数组下标关系；手写了个反转字符串的指针实现，单步调试通过。"
          disabled={readOnly || isSaving}
          required
          maxLength={2000}
          aria-describedby={hasError||isSaved?'studio-supplement-status':undefined}
        />

        {hasError && errorMessage && (
          <div id="studio-supplement-status" className="studio-supplement-form__status studio-supplement-form__status--error" role="alert">
            <span className="studio-supplement-form__status-icon" aria-hidden="true">✕</span>
            <p className="studio-supplement-form__status-text">{errorMessage}</p>
          </div>
        )}

        {isSaved && (
          <div id="studio-supplement-status" className="studio-supplement-form__status studio-supplement-form__status--saved" role="status">
            <span className="studio-supplement-form__status-icon" aria-hidden="true">✓</span>
            <p className="studio-supplement-form__status-text">记录已保存，尚未进行能力评估。</p>
          </div>
        )}

        <div className="studio-supplement-form__actions">
          <span className="studio-supplement-form__char-count">
            {text.length} 字
          </span>

          <button
            type="submit"
            className="studio-supplement-form__submit-button"
            disabled={readOnly || isSaving || !text.trim()}
          >
            {isSaving ? "正在保存…" : "提交补充"}
          </button>
        </div>
      </form>
    </section>
  );
}
