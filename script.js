'use strict';

const $ = (id) => document.getElementById(id);
const storageKey = 'rashody.v1';
const baseCategories = ['Еда', 'Транспорт', 'Дом'];
let state = { categories: [...baseCategories], expenses: [], budgets: [] };
const validMonth = (value) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && !value.startsWith('0000');
const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const validDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && localDate(date) === value;
};
const money = (value) => `${String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₸`;
const categoryKey = (name) => name.toLocaleLowerCase('ru');

try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (saved) {
    if (!Array.isArray(saved.categories) || !Array.isArray(saved.expenses)) throw new Error('format');
    for (const name of saved.categories) {
      if (typeof name !== 'string' || !name.trim()) continue;
      if (!state.categories.some((item) => categoryKey(item) === categoryKey(name.trim()))) state.categories.push(name.trim());
    }
    let sum = 0;
    state.expenses = saved.expenses.filter((item) => {
      if (!item || !Number.isSafeInteger(item.amount) || item.amount <= 0 || !validDate(item.date) || typeof item.category !== 'string' || !item.category.trim() || typeof item.comment !== 'string') return false;
      if (!Number.isSafeInteger(sum + item.amount)) return false;
      sum += item.amount;
      if (!state.categories.includes(item.category)) state.categories.push(item.category);
      return true;
    });
    if (Array.isArray(saved.budgets)) {
      for (const item of saved.budgets) {
        if (!item || !validMonth(item.month) || !state.categories.includes(item.category) || !Number.isSafeInteger(item.limit) || item.limit < 0) continue;
        if (state.budgets.some((entry) => entry.month === item.month && entry.category === item.category)) continue;
        const total = state.budgets.reduce((sum, entry) => sum + (entry.month === item.month ? entry.limit : 0), 0);
        if (Number.isSafeInteger(total + item.limit)) state.budgets.push({ month: item.month, category: item.category, limit: item.limit });
      }
    }
  }
} catch {
  $('form-error').textContent = 'Не удалось прочитать сохранённые данные. Проверьте, доступно ли хранилище браузера.';
}

function save(next, errorId) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(next));
    state = next;
    return true;
  } catch {
    $(errorId).textContent = 'Не удалось сохранить. Проверьте свободное место и доступ к хранилищу браузера.';
    return false;
  }
}

function renderCategories(selected = $('category').value) {
  $('category').replaceChildren(...state.categories.map((name) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    return option;
  }));
  if (state.categories.includes(selected)) $('category').value = selected;
}

function renderTotal() {
  const start = $('period-start').value;
  const end = $('period-end').value;
  const valid = validDate(start) && validDate(end) && start <= end;
  $('period-error').textContent = valid ? '' : 'Укажите верные даты: начало не позже конца периода.';
  $('total').textContent = valid ? money(state.expenses.reduce((sum, item) => sum + (item.date >= start && item.date <= end ? item.amount : 0), 0)) : '—';
}

function updateBudgetAmounts() {
  const month = $('budget-month').value;
  state.categories.forEach((name, index) => {
    const spentNode = $(`budget-spent-${index}`);
    const remainingNode = $(`budget-remaining-${index}`);
    if (!spentNode || !remainingNode) return;
    const spent = state.expenses.reduce((sum, item) => sum + (item.category === name && item.date.slice(0, 7) === month ? item.amount : 0), 0);
    const budget = state.budgets.find((item) => item.month === month && item.category === name);
    spentNode.textContent = `Потрачено: ${money(spent)}`;
    remainingNode.textContent = `Осталось: ${budget ? money(budget.limit - spent) : '—'}`;
    const warning = $(`budget-warning-${index}`);
    const exceeded = budget && spent > budget.limit;
    warning.textContent = exceeded ? `Перерасход на ${money(spent - budget.limit)}` : '';
    remainingNode.className = exceeded ? 'budget-warning' : '';
  });
}

function renderBudgets(focusIndex) {
  const month = $('budget-month').value;
  const valid = validMonth(month);
  $('budget-month-error').textContent = valid ? '' : 'Выберите месяц и год бюджета.';
  $('budget-categories').replaceChildren();
  if (!valid) return;
  state.categories.forEach((name, index) => {
    const saved = state.budgets.find((item) => item.month === month && item.category === name);
    const form = document.createElement('form');
    form.className = 'budget-category';
    form.noValidate = true;
    const heading = document.createElement('h3');
    heading.textContent = name;
    const current = document.createElement('p');
    current.className = 'muted';
    current.textContent = `Лимит: ${saved ? money(saved.limit) : 'Не задан'}`;
    const label = document.createElement('label');
    label.textContent = 'Лимит на месяц, ₸';
    const input = document.createElement('input');
    input.id = `budget-limit-${index}`;
    input.inputMode = 'numeric';
    input.placeholder = 'Например, 15 000';
    input.value = saved ? money(saved.limit).replace(' ₸', '') : '';
    const error = document.createElement('p');
    error.id = `budget-error-${index}`;
    error.className = 'error';
    error.setAttribute('role', 'alert');
    input.setAttribute('aria-describedby', error.id);
    label.append(input);
    const actions = document.createElement('div');
    actions.className = 'presets';
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.textContent = 'Сохранить лимит';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'secondary';
    remove.textContent = 'Убрать лимит';
    remove.hidden = !saved;
    actions.append(submit, remove);
    const status = document.createElement('p');
    status.className = 'muted';
    status.setAttribute('role', 'status');
    form.append(heading, current, label, actions, error, status);
    const amounts = document.createElement('div');
    amounts.setAttribute('aria-live', 'polite');
    const spent = document.createElement('p');
    spent.id = `budget-spent-${index}`;
    const remaining = document.createElement('p');
    remaining.id = `budget-remaining-${index}`;
    const warning = document.createElement('p');
    warning.id = `budget-warning-${index}`;
    warning.className = 'budget-warning';
    amounts.append(spent, remaining, warning);
    form.append(amounts);
    $('budget-categories').append(form);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      error.textContent = '';
      status.textContent = '';
      const raw = input.value.trim();
      const limit = Number(raw.replace(/[ \u00a0\u202f]/g, ''));
      if (!/^\d+(?:[ \u00a0\u202f]\d{3})*$/.test(raw) || !Number.isSafeInteger(limit) || limit < 0) {
        error.textContent = 'Введите целое число от нуля, например 15 000.';
        input.focus();
        return;
      }
      const others = state.budgets.filter((item) => item.month !== month || item.category !== name);
      const total = others.reduce((sum, item) => sum + (item.month === month ? item.limit : 0), 0);
      if (!Number.isSafeInteger(total + limit)) {
        error.textContent = 'Сумма лимитов слишком велика для точного подсчёта.';
        input.focus();
        return;
      }
      if (!save({ ...state, budgets: [...others, { month, category: name, limit }] }, error.id)) return;
      current.textContent = `Лимит: ${money(limit)}`;
      input.value = money(limit).replace(' ₸', '');
      remove.hidden = false;
      status.textContent = 'Лимит сохранён.';
      updateBudgetAmounts();
    });
    remove.addEventListener('click', () => {
      error.textContent = '';
      status.textContent = '';
      const budgets = state.budgets.filter((item) => item.month !== month || item.category !== name);
      if (save({ ...state, budgets }, error.id)) {
        renderBudgets(index);
        $('budget-categories').children[index].querySelector('[role="status"]').textContent = 'Лимит убран.';
      }
    });
  });
  updateBudgetAmounts();
  if (focusIndex !== undefined) $(`budget-limit-${focusIndex}`).focus();
}

function setPeriod(period) {
  const end = new Date();
  const start = new Date(end);
  if (period === 'month') start.setDate(1);
  else start.setDate(start.getDate() - Number(period) + 1);
  $('period-start').value = localDate(start);
  if (period === 'month') end.setMonth(end.getMonth() + 1, 0);
  $('period-end').value = localDate(end);
  $('total-title').textContent = period === 'month' ? 'Итог за текущий месяц' : 'Итог за выбранный период';
  document.querySelectorAll('[data-days]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.days === period)));
  renderTotal();
}

function renderExpenses() {
  $('empty').hidden = state.expenses.length > 0;
  $('expenses').replaceChildren(...state.expenses.map((item) => {
    const li = document.createElement('li');
    const top = document.createElement('div');
    top.className = 'expense-top';
    const category = document.createElement('strong');
    category.textContent = item.category;
    const amount = document.createElement('strong');
    amount.className = 'expense-amount';
    amount.textContent = money(item.amount);
    top.append(category, amount);
    const date = document.createElement('time');
    date.className = 'muted';
    date.dateTime = item.date;
    date.textContent = item.date.split('-').reverse().join('.');
    li.append(top, date);
    if (item.comment) {
      const comment = document.createElement('p');
      comment.className = 'expense-comment';
      comment.textContent = item.comment;
      li.append(comment);
    }
    return li;
  }));
  renderTotal();
}

$('toggle-category').addEventListener('click', () => {
  const open = $('category-panel').hidden;
  $('category-panel').hidden = !open;
  $('toggle-category').setAttribute('aria-expanded', String(open));
  if (open) $('new-category').focus();
});
$('save-category').addEventListener('click', () => {
  const name = $('new-category').value.trim();
  $('category-error').textContent = '';
  if (!name) {
    $('category-error').textContent = 'Введите название категории.';
    $('new-category').focus();
    return;
  }
  const existing = state.categories.find((item) => categoryKey(item) === categoryKey(name));
  if (!existing && !save({ ...state, categories: [...state.categories, name] }, 'category-error')) return;
  renderCategories(existing || name);
  renderBudgets();
  $('new-category').value = '';
  $('category-panel').hidden = true;
  $('toggle-category').setAttribute('aria-expanded', 'false');
  $('category').focus();
});
$('new-category').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') { event.preventDefault(); $('save-category').click(); }
});
$('expense-form').addEventListener('submit', (event) => {
  event.preventDefault();
  $('form-error').textContent = '';
  $('status').textContent = '';
  const raw = $('amount').value.trim();
  const amount = Number(raw.replace(/[ \u00a0\u202f]/g, ''));
  if (!/^\d+(?:[ \u00a0\u202f]\d{3})*$/.test(raw) || !Number.isSafeInteger(amount) || amount <= 0) {
    $('form-error').textContent = 'Введите сумму целым числом больше нуля, например 5 000.';
    $('amount').focus();
    return;
  }
  if (!Number.isSafeInteger(state.expenses.reduce((sum, item) => sum + item.amount, 0) + amount)) {
    $('form-error').textContent = 'Сумма слишком велика для точного подсчёта.';
    return;
  }
  if (!validDate($('date').value)) {
    $('form-error').textContent = 'Укажите верную дату траты.';
    $('date').focus();
    return;
  }
  if (!state.categories.includes($('category').value)) {
    $('form-error').textContent = 'Выберите категорию.';
    return;
  }
  const expense = { amount, category: $('category').value, date: $('date').value, comment: $('comment').value.trim() };
  if (!save({ ...state, expenses: [expense, ...state.expenses] }, 'form-error')) return;
  $('amount').value = '';
  $('comment').value = '';
  $('status').textContent = 'Трата добавлена.';
  renderExpenses();
  updateBudgetAmounts();
  $('amount').focus();
});
$('presets').addEventListener('click', (event) => {
  const button = event.target.closest('[data-days]');
  if (button) setPeriod(button.dataset.days);
});
for (const id of ['period-start', 'period-end']) $(id).addEventListener('change', () => {
  $('total-title').textContent = 'Итог за выбранный период';
  document.querySelectorAll('[data-days]').forEach((button) => button.setAttribute('aria-pressed', 'false'));
  renderTotal();
});
$('date').value = localDate(new Date());
$('budget-month').value = localDate(new Date()).slice(0, 7);
$('budget-month').addEventListener('change', () => renderBudgets());
renderBudgets();
renderCategories();
setPeriod('month');
renderExpenses();
