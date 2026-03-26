function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return url ?? null;
  }
}

async function readPageAvailability(page) {
  if (!page) {
    return { available: false, finalUrl: null };
  }

  if (page.isClosed?.() === true) {
    return { available: false, finalUrl: null };
  }

  const finalUrl = page.url?.() ?? null;
  if (!finalUrl) {
    return { available: false, finalUrl: null };
  }

  try {
    if (typeof page.evaluate === 'function') {
      await page.evaluate(() => document.location.href);
    }
    return { available: true, finalUrl };
  } catch {
    return { available: false, finalUrl };
  }
}

export function createEntryOrchestrator({
  directGoto,
  trustedContextOpen,
} = {}) {
  const runStrategy = async (strategy, targetUrl, state) => {
    if (strategy === 'direct_goto') {
      return directGoto(targetUrl, { state });
    }
    if (strategy === 'trusted_context_open') {
      return trustedContextOpen(targetUrl, { state });
    }
    throw new Error(`Unknown entry strategy: ${strategy}`);
  };

  return {
    async run({ targetUrl, strategies = [], state = null }) {
      const attempts = [];
      let lastAttempt = {
        page: null,
        finalUrl: null,
        strategy: strategies[0] ?? null,
      };

      for (const strategy of strategies) {
        lastAttempt = {
          page: null,
          finalUrl: null,
          strategy,
        };

        try {
          const page = await runStrategy(strategy, targetUrl, state);
          const { available, finalUrl } = await readPageAvailability(page);
          const verified = normalizeUrl(finalUrl) === normalizeUrl(targetUrl);

          lastAttempt = {
            page,
            finalUrl,
            strategy,
          };

          attempts.push({
            strategy,
            final_url: finalUrl,
            page_available: available,
            verified,
          });

          if (verified) {
            return {
              page,
              entry_method: strategy,
              final_url: finalUrl,
              verified: true,
              evidence: { attempts },
            };
          }
        } catch (error) {
          attempts.push({
            strategy,
            final_url: null,
            page_available: false,
            verified: false,
            error: error.message,
          });
        }
      }

      return {
        page: lastAttempt.page,
        entry_method: lastAttempt.strategy,
        final_url: lastAttempt.finalUrl,
        verified: false,
        evidence: { attempts },
      };
    },
  };
}
