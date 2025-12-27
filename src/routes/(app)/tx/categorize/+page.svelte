<script lang="ts">
  import { onMount } from 'svelte';
  import { getNextTx, assignCategory } from '$lib/api/tx';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { Icon } from '@steeze-ui/svelte-icon';
  import * as icons from '@steeze-ui/heroicons';

  let loading = true;
  let error: string | null = null;

  let current: {
    tx: {
      id: string;
      date: string;
      amount: number;
      description?: string;
      notes?: string;
      category?: string;
      tags?: string[];
    };
    categories: { id: string; name: string }[];
  } | null = null;

  let afterId: number | null = null;
  let selectedCategory: number | null = null;

  async function loadNext() {
    loading = true;
    error = null;

    const token = localStorage.getItem('access_token');
    if (!token) return goto('/login');

    try {
      current = await getNextTx({ order: 'asc', after_id: afterId }, token);

      if (current) {
        afterId = Number(current.tx.id);
        selectedCategory = current.tx.category !== undefined ? Number(current.tx.category) : null;
      }
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  onMount(loadNext);

  function skip() {
    loadNext();
  }

  async function assign() {
    const token = localStorage.getItem('access_token');
    if (!token) return goto('/login');
    if (!current || selectedCategory === null) return;

    try {
      await assignCategory(Number(current.tx.id), selectedCategory, token);

      window.dispatchEvent(
        new CustomEvent('toast', {
          detail: { type: 'success', msg: 'Category assigned' }
        })
      );

      await loadNext();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to assign category';

      window.dispatchEvent(
        new CustomEvent('toast', {
          detail: { type: 'error', msg: message }
        })
      );
    }
  }

  const PRIMARY_TAGS = new Set(['blik_done', 'allegro_done']);

  const isPrimary = (tag: string) => PRIMARY_TAGS.has(tag);
</script>

<div class="card bg-base-100 mt-2 w-full p-6 shadow-xl">
  <div class="inline-block text-xl font-semibold">
    Transaction Screening
    <!-- <div class="float-right inline-block">
      <div class="float-right inline-block">
          <button class="btn btn-sm btn-primary px-6 normal-case">Add New</button>
        </div>
    </div> -->
  </div>
  <div class="divider mt-2"></div>
  <div class="bg-base-100 h-full w-full pb-6">
    <div class="w-full overflow-x-auto">
      {#if loading}
        <div class="overflow-x-auto">
          <table class="table">
            <!-- head -->
            <tbody>
              <!-- row 1 -->
              <tr>
                <th>ID / Date</th>
                <td><div class="skeleton h-8 w-100"></div></td>
              </tr>
              <tr>
                <th>Description:</th>
                <td><div class="skeleton h-8 w-100"></div></td>
              </tr>
              <tr>
                <th>Amount:</th>
                <td><div class="skeleton h-8 w-100"></div></td>
              </tr>
              <tr>
                <th>Notes:</th>
                <td>
                  <div class="skeleton h-48 w-100"></div>
                </td>
              </tr>
              <tr>
                <th>Tags:</th>
                <td>
                  <div class="skeleton h-8 w-100"></div>
                </td>
              </tr>
              <tr>
                <th>Category:</th>
                <td>
                  <div class="skeleton h-8 w-100"></div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      {:else if error}
        <div role="alert" class="alert alert-error">
          <Icon src={icons.ExclamationTriangle} class="h-5 w-5" />
          <span>Error! {error}</span>
        </div>
      {:else if current === null}
        <div role="alert" class="alert alert-info">
          <Icon src={icons.InformationCircle} class="h-5 w-5" />
          <span>Inbox zero. Nie ma więcej transakcji.</span>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="table">
            <!-- head -->
            <tbody>
              <!-- row 1 -->
              <tr>
                <th>ID / Date</th>
                <td>
                  {current.tx.id} //
                  {current.tx.date}
                </td>
              </tr>
              <tr>
                <th>Description:</th>
                <td>{current.tx.description}</td>
              </tr>
              <tr>
                <th>Amount:</th>
                <td>{current.tx.amount} PLN </td>
              </tr>
              <tr>
                <th>Notes:</th>
                <td class="h-48">
                  <div class="text-base-content/80 text-sm whitespace-pre-wrap">
                    {current.tx.notes}
                  </div>
                </td>
              </tr>
              <tr>
                <th>Tags:</th>
                <td>
                  {#if current.tx.tags?.length}
                    {#each current.tx.tags as tag}
                      <span class={`badge ${isPrimary(tag) ? 'badge-primary' : 'badge-outline'}`}>
                        {tag}
                      </span>
                    {/each}
                  {/if}
                </td>
              </tr>
              <tr>
                <th>Category:</th>
                <td>
                  <select class="select" bind:value={selectedCategory}>
                    <option value="">— None —</option>

                    {#each current.categories as c}
                      <option value={c.id}>{c.name}</option>
                    {/each}
                  </select>

                  <button class="btn btn-primary" on:click={assign} disabled={!selectedCategory}>
                    Assign
                  </button>
                  <p class="text-xs opacity-50">
                    selectedCategory = {JSON.stringify(selectedCategory)}
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      {/if}
      <div class="mt-6 flex justify-center">
        <div class="join">
          <button class="btn join-item">Insufficient Data</button>
          <button class="btn join-item">Rule Potential</button>
          <button class="btn join-item" on:click={skip}>Skip</button>
        </div>
      </div>
    </div>
  </div>
</div>
