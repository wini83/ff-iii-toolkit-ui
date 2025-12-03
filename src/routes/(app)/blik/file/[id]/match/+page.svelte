<script lang="ts">
  import { API_BASE } from '$lib/config';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';

  // --- Typy (prosty, praktyczny model dla UI) ---
  type SimplifiedTx = {
    id: string;
    date: string;
    amount: number;
    description?: string;
    tags?: string[];
    notes?: string;
  };

  type SimplifiedRecord = {
    date: string;
    amount?: number;
    operation_amount?: number;
    operation_currency?: string;
    details?: string;
    sender?: string;
    recipient?: string;
    sender_account?: string;
    recipient_account?: string;
  };

  type MatchRow = {
    tx: SimplifiedTx;
    matches: SimplifiedRecord[];
    _matched?: boolean;
  };

  type MatchData = {
    file_id?: string;
    decoded_name?: string;
    records_in_file?: number;
    transactions_found?: number;
    transactions_not_matched?: number;
    transactions_with_one_match?: number;
    transactions_with_many_matches?: number;
    content: MatchRow[];
  };

  // --- State ---
  let matchData: MatchData | null = null;
  let loading = true;
  let error = '';
  let selected: Set<string> = new Set();

  // traktujemy ID jako string, dajemy fallback dla undefined
  let fileId: string = '';

  // poprawna subskrypcja store 'page' z fallbackiem
  const unsubscribe = page.subscribe((p) => {
    fileId = (p.params?.id as string) ?? '';
  });

  onMount(() => {
    loadData();
    return () => unsubscribe();
  });

  // --- Derived safe content for template (avoids "possibly null" TS errors) ---
  // $: makes these reactive so UI updates automatically
  $: content = (matchData?.content ?? []) as MatchRow[];
  $: oneMatches =
    matchData?.transactions_with_one_match ??
    content.filter((r) => (r.matches?.length ?? 0) === 1).length;
  $: manyMatches =
    matchData?.transactions_with_many_matches ??
    content.filter((r) => (r.matches?.length ?? 0) > 1).length;
  $: noMatches =
    matchData?.transactions_not_matched ??
    content.filter((r) => (r.matches?.length ?? 0) === 0).length;

  // --- Functions ---
  async function loadData() {
    loading = true;
    error = '';

    const token = localStorage.getItem('access_token');
    if (!token) return goto('/login');

    try {
      const resp = await fetch(`${API_BASE}/api/file/do-match/${fileId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(`Server error ${resp.status} ${txt}`);
      }

      const json = await resp.json();
      matchData = {
        ...json,
        content: Array.isArray(json.content) ? json.content : []
      } as MatchData;
    } catch (e) {
      console.error(e);
      error = 'Nie udało się pobrać danych matchowania';
      matchData = null;
    } finally {
      loading = false;
    }
  }

  function toggle(id: string) {
    if (selected.has(id)) {
      selected.delete(id);
      selected = new Set(selected); // reasignacja by Svelte wykrył zmianę
    } else {
      selected.add(id);
      selected = new Set(selected);
    }
  }

  async function applyMatches() {
    const token = localStorage.getItem('access_token');
    if (!token) return goto('/login');

    const ids = Array.from(selected);

    if (!ids.length) {
      window.dispatchEvent(
        new CustomEvent('toast', {
          detail: { type: 'info', msg: 'Brak zaznaczonych transakcji' }
        })
      );
      return;
    }

    try {
      const resp = await fetch(`${API_BASE}/api/file/apply_match/${fileId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ csv_indexes: ids })
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(`apply failed (${resp.status}) ${txt}`);
      }

      // oznacz lokalnie jako matched — i wymuś re-render
      for (const id of ids) {
        const row = content.find((r) => String(r.tx.id) === String(id));
        if (row) row._matched = true;
      }

      // wymuś re-render: shallow-copy tablicy i elementów
      matchData = {
        ...matchData!,
        content: content.map((r) => ({ ...r }))
      };

      // wyczyść zaznaczenia
      selected = new Set();

      window.dispatchEvent(
        new CustomEvent('toast', {
          detail: { type: 'success', msg: `Transaction updated` }
        })
      );
    } catch (e) {
      console.error(e);
      window.dispatchEvent(
        new CustomEvent('toast', {
          detail: { type: 'error', msg: 'Nie udało się zapisać dopasowań' }
        })
      );
    }
  }
</script>

<!-- STEPS -->
<div class="card bg-base-100 mt-2 w-full p-6 shadow-xl">
  <ul class="steps hidden w-1/2 flex-none md:flex">
    <li class="step step-primary"><a href="/blik/upload">Upload</a></li>
    <li class="step step-primary"><a href="/blik/file/">Preview</a></li>
    <li class="step step-primary"><a href="/blik/file/match">Match</a></li>
  </ul>
</div>

<div class="card bg-base-100 mt-2 w-full p-6 shadow-xl">
  <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
    <div>
      <div class="text-xl font-semibold">Matchowanie transakcji</div>
      <div class="text-sm opacity-60">Plik: {matchData?.decoded_name ?? '—'}</div>
    </div>

    <!-- KPI WIDGET -->
    <div class="w-full md:w-1/2">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="p-3 rounded-lg border border-base-200 bg-base-100">
          <div class="text-xs opacity-60">Jednoznaczne</div>
          <div class="text-lg font-semibold text-green-600">{oneMatches}</div>
        </div>

        <div class="p-3 rounded-lg border border-base-200 bg-base-100">
          <div class="text-xs opacity-60">Wieloznaczne</div>
          <div class="text-lg font-semibold text-yellow-600">{manyMatches}</div>
        </div>

        <div class="p-3 rounded-lg border border-base-200 bg-base-100">
          <div class="text-xs opacity-60">Brak</div>
          <div class="text-lg font-semibold text-gray-600">{noMatches}</div>
        </div>

        <div class="p-3 rounded-lg border border-base-200 bg-base-100">
          <div class="text-xs opacity-60">Zaznaczone</div>
          <div class="text-lg font-semibold">{selected.size}</div>
        </div>
      </div>
    </div>
  </div>

  <div class="divider mt-2"></div>

  {#if loading}
    <div class="alert alert-info">Ładowanie…</div>
  {:else if error}
    <div class="alert alert-error">{error}</div>
  {:else if content.length === 0}
    <div class="alert alert-warning">Brak danych do matchowania.</div>
  {:else}
    <form class="space-y-4">
      <div class="bg-base-100 h-full w-full pb-6">
        <div class="overflow-x-auto">
          <table class="table w-full">
            <thead>
              <tr>
                <th>Firefly TX</th>
                <th>Dopasowania CSV</th>
                <th>Status</th>
                <th>Akcja</th>
              </tr>
            </thead>
            <tbody>
              {#each content as r (r.tx.id)}
                <tr
                  class="hover:bg-base-200 text-sm"
                  class:bg-green-50={r._matched}
                  class:opacity-50={r._matched}
                >
                  <td>
                    <b>{r.tx.date}</b><br />
                    ID: {r.tx.id}<br />
                    Kwota: {r.tx.amount} PLN<br />
                    Opis: {r.tx.description}<br />

                    <div class="mt-2 flex flex-wrap gap-2">
                      {#each r.tx.tags ?? [] as t}
                        <div
                          class="bg-base-200 border-base-300 max-w-[160px] overflow-hidden rounded-full border px-2 py-0.5 text-xs text-ellipsis"
                          title={t}
                        >
                          {t}
                        </div>
                      {/each}
                    </div>

                    <span class="text-xs opacity-70">{r.tx.notes}</span>
                  </td>

                  <td>
                    {#if !r.matches || r.matches.length === 0}
                      -
                    {:else}
                      {#each r.matches as m, i}
                        <div class="mb-3">
                          <b>{m.date}</b><br />
                          Kwota: {m.operation_amount} {m.operation_currency}<br />
                          Szczegóły: {m.details}<br />
                          Nadawca: {m.sender}<br />
                          Odbiorca: {m.recipient}<br />
                          <span class="text-xs opacity-70">
                            {m.sender_account}<br />
                            {m.recipient_account}
                          </span>
                        </div>
                        {#if i < r.matches.length - 1}
                          <hr class="my-2" />
                        {/if}
                      {/each}
                    {/if}
                  </td>

                  <td
                    class={r._matched
                      ? 'font-semibold text-green-700'
                      : r.matches.length === 1
                        ? 'font-semibold text-green-600'
                        : r.matches.length > 1
                          ? 'font-semibold text-yellow-600'
                          : 'text-gray-500'}
                  >
                    {#if r._matched}
                      Zmatchowano
                    {:else if r.matches.length === 0}
                      Brak dopasowania
                    {:else if r.matches.length === 1}
                      ✔ 1 dopasowanie
                    {:else}
                      {r.matches.length} możliwych dopasowań
                    {/if}
                  </td>

                  <td class="text-center">
                    {#if r._matched}
                      <span title="Zmatchowano">✔</span>
                    {:else if r.matches.length === 1}
                      <input
                        type="checkbox"
                        class="checkbox checkbox-primary"
                        checked={selected.has(String(r.tx.id))}
                        on:change={() => toggle(String(r.tx.id))}
                      />
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>

      <button type="button" class="btn btn-primary mt-4" on:click={applyMatches}>
        ✔ Zastosuj dopasowania
      </button>
    </form>
  {/if}
</div>
