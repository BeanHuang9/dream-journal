const { createApp, ref, computed, watch, nextTick } = Vue;

const API =
  'https://script.google.com/macros/s/AKfycbx-ZLp9mRKybL6hMdblT16Velz84U43ev2FuaSc2b9Zpn7A9I31Er-_rK30L2l2PihOtA/exec';

createApp({
  setup() {
    // ── 常數 ──
    const tabs = [
      { id: 'record', label: '✏️ 記錄夢境' },
      { id: 'log', label: '📚 夢境日誌' },
      { id: 'analytics', label: '🔮 夢境分析' },
    ];
    const moods = [
      { value: 'good', emoji: '🌈', label: '好夢超開心' },
      { value: 'bad', emoji: '👻', label: '惡夢好可怕' },
      { value: 'neutral', emoji: '☁️', label: '一般般的夢' },
      { value: 'weird', emoji: '🌀', label: '困惑的怪夢' },
      { value: 'none', emoji: '💤', label: '這晚沒做夢' },
      { value: 'forgot', emoji: '🌫️', label: '夢了忘光光' },
    ];
    const moodMeta = {
      good: { emoji: '🌈', label: '好夢', cls: 'bg-good' },
      bad: { emoji: '👻', label: '惡夢', cls: 'bg-bad' },
      neutral: { emoji: '☁️', label: '一般夢', cls: 'bg-neutral' },
      weird: { emoji: '🌀', label: '怪夢', cls: 'bg-weird' },
      none: { emoji: '💤', label: '沒做夢', cls: 'bg-none' },
      forgot: { emoji: '🌫️', label: '忘記了', cls: 'bg-forgot' },
    };
    const filters = [
      { value: 'all', label: '全部 🌀' },
      { value: 'good', label: '好夢 🌈' },
      { value: 'bad', label: '惡夢 👻' },
      { value: 'neutral', label: '一般 ☁️' },
      { value: 'weird', label: '怪夢 🌀' },
      { value: 'none', label: '無夢 💤' },
      { value: 'forgot', label: '忘記 🌫️' },
    ];
    const barColors = [
      '#ffd95c',
      '#5ddcb0',
      '#ff85b3',
      '#72c3f5',
      '#b49eff',
      '#ff9f4a',
      '#6dd97a',
      '#ff6b6b',
    ];

    // ── 狀態 ──
    const dreams = ref([]);
    const loading = ref(false);
    const saving = ref(false);
    const currentTab = ref('record');
    const currentFilter = ref('all');
    const searchQuery = ref('');
    const modalDream = ref(null);
    const tagInput = ref('');
    const donutCanvas = ref(null);
    const toast = ref({ show: false, msg: '', err: false });
    let toastTimer = null;

    const form = ref({ date: today(), title: '', mood: '', content: '', tags: [] });

    // ── 工具 ──
    function today() {
      return new Date().toISOString().split('T')[0];
    }
    function fmtDate(s) {
      const d = new Date(s + 'T00:00:00');
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    }
    function showToast(msg, err = false) {
      clearTimeout(toastTimer);
      toast.value = { show: true, msg, err };
      toastTimer = setTimeout(() => (toast.value.show = false), 2600);
    }

    // ── API ──
    async function loadDreams() {
      loading.value = true;
      try {
        const res = await fetch(API);
        const json = await res.json();
        if (json.ok) {
          dreams.value = json.data.map((d, i) => ({ ...d, id: i + 1 })).reverse();
        }
      } catch {
        showToast('⚠️ 無法連線到 Google Sheets', true);
      }
      loading.value = false;
    }

    async function saveDream() {
      if (!form.value.date) {
        showToast('📅 請選擇日期！', true);
        return;
      }
      if (!form.value.mood) {
        showToast('🎭 選一下夢境類型～', true);
        return;
      }
      if (form.value.mood !== 'none' && form.value.mood !== 'forgot' && !form.value.content) {
        showToast('💭 把夢境寫下來吧！', true);
        return;
      }

      saving.value = true;
      try {
        await fetch(API, {
          method: 'POST',
          mode: 'no-cors',
          body: JSON.stringify({ action: 'add', ...form.value }),
        });
        dreams.value.unshift({ ...form.value, id: Date.now() });
        resetForm();
        showToast('🌟 夢境記錄好囉！');
      } catch {
        showToast('⚠️ 儲存失敗，請檢查網路', true);
      }
      saving.value = false;
    }

    async function deleteDream(dream) {
      if (!confirm('確定要刪掉這個夢嗎？')) return;
      try {
        await fetch(API, {
          method: 'POST',
          mode: 'no-cors',
          body: JSON.stringify({
            action: 'delete',
            date: dream.date,
            title: dream.title,
            mood: dream.mood,
          }),
        });
        dreams.value = dreams.value.filter((d) => d.id !== dream.id);
        showToast('🗑️ 刪掉了！');
      } catch {
        showToast('⚠️ 刪除失敗，請檢查網路', true);
      }
    }

    // ── Form helpers ──
    function resetForm() {
      form.value = { date: today(), title: '', mood: '', content: '', tags: [] };
      tagInput.value = '';
    }
    function addTag() {
      const v = tagInput.value.trim();
      if (!v || form.value.tags.includes(v)) return;
      form.value.tags.push(v);
      tagInput.value = '';
    }
    function removeTag(i) {
      form.value.tags.splice(i, 1);
    }

    // ── Modal ──
    function openModal(d) {
      modalDream.value = d;
    }

    // ── Filter ──
    function filterChipClass(val) {
      if (currentFilter.value !== val) return '';
      return val === 'all' ? 'af' : `af af-${val}`;
    }

    // ── Computed ──
    const countByMood = (mood) => dreams.value.filter((d) => d.mood === mood).length;
    const uniqueDays = computed(() => new Set(dreams.value.map((d) => d.date)).size);

    const filteredDreams = computed(() => {
      const q = searchQuery.value.toLowerCase();
      return dreams.value.filter((d) => {
        if (currentFilter.value !== 'all' && d.mood !== currentFilter.value) return false;
        if (q && ![d.title, d.content, ...(d.tags || [])].join(' ').toLowerCase().includes(q))
          return false;
        return true;
      });
    });

    const donutSegs = computed(() => {
      const cnt = { good: 0, bad: 0, neutral: 0, weird: 0, none: 0, forgot: 0 };
      dreams.value.forEach((d) => {
        if (cnt[d.mood] !== undefined) cnt[d.mood]++;
      });
      return [
        { label: '好夢 🌈', v: cnt.good, col: '#5ddcb0' },
        { label: '惡夢 👻', v: cnt.bad, col: '#ff6b6b' },
        { label: '一般 ☁️', v: cnt.neutral, col: '#b49eff' },
        { label: '怪夢 🌀', v: cnt.weird, col: '#c084fc' },
        { label: '無夢 💤', v: cnt.none, col: '#ffb38a' },
        { label: '忘記 🌫️', v: cnt.forgot, col: '#b0c4de' },
      ];
    });

    const tagStats = computed(() => {
      const tc = {};
      dreams.value.forEach((d) => (d.tags || []).forEach((t) => (tc[t] = (tc[t] || 0) + 1)));
      const sorted = Object.entries(tc)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);
      const max = sorted[0]?.[1] || 1;
      return sorted.map(([tag, count]) => ({ tag, count, pct: Math.round((count / max) * 100) }));
    });

    const calCells = computed(() => {
      const bd = {};
      dreams.value.forEach((d) => {
        if (!bd[d.date]) bd[d.date] = [];
        bd[d.date].push(d.mood);
      });
      const cells = [];
      // leading ghost cells
      const first = new Date();
      first.setDate(first.getDate() - 27);
      for (let p = 0; p < first.getDay(); p++) cells.push({ cls: '', ghost: true, title: '' });
      // actual 28 days
      for (let i = 27; i >= 0; i--) {
        const dt = new Date();
        dt.setDate(dt.getDate() - i);
        const ds = dt.toISOString().split('T')[0];
        const moods = bd[ds] || [];
        let cls = '';
        if (moods.length) {
          const unique = [...new Set(moods)];
          if (unique.length > 1) {
            cls = 'cm';
          } else {
            const m = unique[0];
            cls = m === 'good' ? 'cg' : m === 'bad' ? 'cb' : m === 'neutral' ? 'cn'
                : m === 'weird' ? 'cw' : m === 'none' ? 'cno' : m === 'forgot' ? 'cf' : 'cn';
          }
        }
        const ml = moods.map((m) => moodMeta[m]?.label || m).join('/');
        cells.push({ cls, ghost: false, title: ds + (ml ? ' · ' + ml : '') });
      }
      return cells;
    });

    // ── Draw donut ──
    function drawDonut() {
      const canvas = donutCanvas.value;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const segs = donutSegs.value;
      const total = dreams.value.length || 1;
      const cx = 57,
        cy = 57,
        r = 46,
        inner = 28;
      ctx.clearRect(0, 0, 114, 114);
      let ang = -Math.PI / 2;
      segs.forEach((s) => {
        const sw = (s.v / total) * 2 * Math.PI;
        if (!sw) return;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, ang, ang + sw);
        ctx.closePath();
        ctx.fillStyle = s.col;
        ctx.fill();
        ang += sw;
      });
      ctx.beginPath();
      ctx.arc(cx, cy, inner, 0, 2 * Math.PI);
      ctx.fillStyle = 'white';
      ctx.fill();
      ctx.fillStyle = '#2d2040';
      ctx.font = '900 15px "Zen Maru Gothic",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(dreams.value.length, cx, cy);
    }

    // re-draw donut when tab switches to analytics or dreams change
    watch([currentTab, dreams], async () => {
      if (currentTab.value === 'analytics') {
        await nextTick();
        drawDonut();
      }
    });

    // ── Init ──
    loadDreams();

    return {
      tabs,
      moods,
      moodMeta,
      filters,
      barColors,
      dreams,
      loading,
      saving,
      currentTab,
      currentFilter,
      searchQuery,
      modalDream,
      tagInput,
      donutCanvas,
      toast,
      form,
      today,
      fmtDate,
      showToast,
      loadDreams,
      saveDream,
      deleteDream,
      resetForm,
      addTag,
      removeTag,
      openModal,
      filterChipClass,
      countByMood,
      uniqueDays,
      filteredDreams,
      donutSegs,
      tagStats,
      calCells,
    };
  },
}).mount('#app');
