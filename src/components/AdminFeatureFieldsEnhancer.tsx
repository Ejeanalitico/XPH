import { useEffect } from 'react';

const FEATURE_TEXTAREA_SELECTOR = 'textarea[placeholder="Un servicio incluido por línea"]';

const setNativeTextareaValue = (textarea: HTMLTextAreaElement, value: string) => {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    'value'
  );
  descriptor?.set?.call(textarea, value);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));
};

const enhanceTextarea = (textarea: HTMLTextAreaElement) => {
  if (textarea.dataset.xphFeatureEnhanced === 'true') return;
  textarea.dataset.xphFeatureEnhanced = 'true';
  textarea.style.display = 'none';

  const wrapper = document.createElement('div');
  wrapper.dataset.xphFeatureEditor = 'true';
  wrapper.className = 'space-y-2 rounded-xl border border-white/10 bg-[#0B0F17]/60 p-3';

  const header = document.createElement('div');
  header.className = 'flex items-center justify-between gap-3 mb-1';

  const label = document.createElement('span');
  label.className = 'text-[11px] font-semibold uppercase tracking-wider text-[#D4AF37]';
  label.textContent = 'Servicios incluidos';

  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.className = 'px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] font-semibold text-gray-200 hover:border-[#D4AF37]/50 hover:text-[#D4AF37] transition-colors';
  addButton.textContent = '+ Agregar servicio';

  header.append(label, addButton);

  const list = document.createElement('div');
  list.className = 'space-y-2';

  const help = document.createElement('p');
  help.className = 'text-[10px] text-gray-500 mt-2';
  help.textContent = 'Presiona Enter para crear el siguiente servicio. Usa × para eliminar una línea.';

  let values = textarea.value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
  if (values.length === 0) values = [''];

  const sync = () => {
    setNativeTextareaValue(
      textarea,
      values.map((item) => item.trim()).filter(Boolean).join('\n')
    );
  };

  const focusRow = (index: number) => {
    window.requestAnimationFrame(() => {
      const inputs = list.querySelectorAll<HTMLInputElement>('input[data-xph-feature-row]');
      const input = inputs[index];
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    });
  };

  const renderRows = (focusIndex?: number) => {
    list.innerHTML = '';

    values.forEach((value, index) => {
      const row = document.createElement('div');
      row.className = 'flex items-center gap-2';

      const input = document.createElement('input');
      input.type = 'text';
      input.dataset.xphFeatureRow = 'true';
      input.value = value;
      input.placeholder = `Servicio ${index + 1}`;
      input.autocomplete = 'off';
      input.className = 'min-w-0 flex-1 px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/15 text-white placeholder:text-gray-600 outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/30 caret-[#D4AF37]';

      input.addEventListener('input', () => {
        values[index] = input.value;
        sync();
      });

      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          values[index] = input.value;
          values.splice(index + 1, 0, '');
          sync();
          renderRows(index + 1);
          return;
        }

        if (event.key === 'Backspace' && input.value === '' && values.length > 1) {
          event.preventDefault();
          values.splice(index, 1);
          sync();
          renderRows(Math.max(0, index - 1));
        }
      });

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.setAttribute('aria-label', `Eliminar servicio ${index + 1}`);
      removeButton.title = 'Eliminar servicio';
      removeButton.className = 'w-10 h-10 shrink-0 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 text-xl leading-none flex items-center justify-center transition-colors';
      removeButton.textContent = '×';
      removeButton.addEventListener('click', () => {
        if (values.length === 1) {
          values[0] = '';
          sync();
          renderRows(0);
          return;
        }
        values.splice(index, 1);
        sync();
        renderRows(Math.min(index, values.length - 1));
      });

      row.append(input, removeButton);
      list.append(row);
    });

    if (typeof focusIndex === 'number') focusRow(focusIndex);
  };

  addButton.addEventListener('click', () => {
    values.push('');
    renderRows(values.length - 1);
  });

  wrapper.append(header, list, help);
  textarea.insertAdjacentElement('beforebegin', wrapper);
  renderRows();
};

export const AdminFeatureFieldsEnhancer = () => {
  useEffect(() => {
    const enhanceAll = () => {
      document
        .querySelectorAll<HTMLTextAreaElement>(FEATURE_TEXTAREA_SELECTOR)
        .forEach(enhanceTextarea);
    };

    enhanceAll();

    const observer = new MutationObserver(() => enhanceAll());
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
};
