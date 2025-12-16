// script.js (vanilla, ESM)
//
// ✅ Farcaster Mini App SDK integration (required by spec).
import { sdk } from "https://esm.sh/@farcaster/miniapp-sdk";
import { Attribution } from "https://esm.sh/ox/erc8021";

// =========================
// CONFIG (EDIT THESE)
// =========================
const BUILDER_CODE = "TODO_REPLACE_BUILDER_CODE"; // from base.dev → Settings → Builder Code
const RECIPIENT = "0x0000000000000000000000000000000000000000"; // your address (where tips go)

// Base chain IDs
const BASE_MAINNET = "0x2105";  // 8453
const BASE_SEPOLIA = "0x14a34"; // 84532

// USDC on Base (mainnet). (If you want Sepolia support, switch address when chainId == BASE_SEPOLIA.)
const USDC_MAINNET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC

// USDC has 6 decimals
const USDC_DECIMALS = 6;

// wallet_sendCalls strict schema (Base Account / Coinbase Keys is strict)
const SENDCALLS_VERSION = "2.0.0";

// =========================
// helpers
// =========================
const $ = (id) => document.getElementById(id);
const overlay = $("overlay");
const statusEl = $("status");
const envLine = $("envLine");
const chainPill = $("chainPill");
const toast = $("toast");
const sendBtn = $("sendBtn");
const custom = $("custom");
const presetRow = $("presetRow");

function showToast(msg){
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(()=>toast.classList.remove("show"), 2400);
}

function openSheet(){ overlay.classList.add("show"); statusEl.textContent=""; }
function closeSheet(){ overlay.classList.remove("show"); }

function setStatus(msg){ statusEl.textContent = msg || ""; }

function parseAmountUsdc(){
  // preset active or custom
  const active = presetRow.querySelector(".amt.active");
  if (active) return active.getAttribute("data-usdc");
  const v = (custom.value || "").trim();
  return v;
}

function toUSDCBaseUnits(amountStr){
  // supports decimals. returns bigint.
  const s = (amountStr || "").trim();
  if (!s) throw new Error("Enter an amount");
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error("Invalid amount");
  const [a,b=""] = s.split(".");
  const frac = (b + "0".repeat(USDC_DECIMALS)).slice(0, USDC_DECIMALS);
  const bi = BigInt(a) * (10n ** BigInt(USDC_DECIMALS)) + BigInt(frac || "0");
  if (bi <= 0n) throw new Error("Amount must be > 0");
  return bi;
}

function encodeErc20Transfer(to, amountBaseUnits){
  // function transfer(address,uint256) => a9059cbb
  const selector = "0xa9059cbb";
  const addr = to.toLowerCase().replace(/^0x/,"").padStart(64,"0");
  const amt = amountBaseUnits.toString(16).padStart(64,"0");
  return selector + addr + amt;
}

async function getProvider(){
  const eth = window.ethereum;
  if (!eth || !eth.request) throw new Error("No wallet provider found. Open inside Base App / Farcaster client with wallet support.");
  return eth;
}

async function ensureBaseChain(provider){
  const chainId = await provider.request({ method: "eth_chainId" });
  if (chainId === BASE_MAINNET || chainId === BASE_SEPOLIA) return chainId;
  // try switch to Base mainnet
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BASE_MAINNET }],
    });
    return BASE_MAINNET;
  } catch (e) {
    throw new Error("Please switch your wallet to Base network.");
  }
}

async function requestAccount(provider){
  const accounts = await provider.request({ method: "eth_requestAccounts" });
  const from = accounts?.[0];
  if (!from) throw new Error("No wallet account selected.");
  return from;
}

// =========================
// Tip state machine (matches your UX spec)
// select -> preparing -> confirm -> sending -> done
// =========================
let tipState = "select"; // select | preparing | confirm | sending | done

function setTipState(next){
  tipState = next;
  if (next === "select") {
    sendBtn.disabled = false;
    sendBtn.textContent = "Send USDC";
  }
  if (next === "preparing") {
    sendBtn.disabled = true;
    sendBtn.textContent = "Preparing tip…";
  }
  if (next === "confirm") {
    sendBtn.disabled = true;
    sendBtn.textContent = "Confirm in wallet";
  }
  if (next === "sending") {
    sendBtn.disabled = true;
    sendBtn.textContent = "Sending…";
  }
  if (next === "done") {
    sendBtn.disabled = false;
    sendBtn.textContent = "Send again";
  }
}

// =========================
// main
// =========================
window.addEventListener("load", async () => {
  // Required: detect env + call ready()
  const isMini = await sdk.isInMiniApp();
  envLine.textContent = isMini ? "Running inside Mini App" : "Running in browser (wallet required)";
  await sdk.actions.ready();

  // UI wiring
  $("tipBtn").addEventListener("click", openSheet);
  $("closeBtn").addEventListener("click", closeSheet);
  overlay.addEventListener("click", (e)=>{ if (e.target === overlay) closeSheet(); });

  // preset selection
  presetRow.addEventListener("click", (e)=>{
    const el = e.target.closest(".amt");
    if (!el) return;
    presetRow.querySelectorAll(".amt").forEach(x=>x.classList.remove("active"));
    el.classList.add("active");
    custom.value = "";
    setTipState("select");
    setStatus("");
  });
  custom.addEventListener("input", ()=>{
    presetRow.querySelectorAll(".amt").forEach(x=>x.classList.remove("active"));
    setTipState("select");
    setStatus("");
  });

  // send
  sendBtn.addEventListener("click", async () => {
    try {
      if (!BUILDER_CODE || BUILDER_CODE.startsWith("TODO")) {
        showToast("Set your BUILDER_CODE in script.js");
        return;
      }
      if (!RECIPIENT || RECIPIENT === "0x0000000000000000000000000000000000000000") {
        showToast("Set your RECIPIENT address in script.js");
        return;
      }

      const amountStr = parseAmountUsdc();
      const amount = toUSDCBaseUnits(amountStr);

      // (3) Pre-transaction animation: 1–1.5s, purely emotional.
      setTipState("preparing");
      setStatus("Warming up…");
      try { window.__BR_UI__?.pulseBoost?.(1200); } catch {}

      await new Promise(r => setTimeout(r, 1200));

      // (4) Confirmation state (RIGHT BEFORE opening wallet UI)
      setTipState("confirm");
      setStatus("Confirm in wallet");

      // Now real transaction triggers
      const provider = await getProvider();
      const chainId = await ensureBaseChain(provider);
      chainPill.textContent = chainId === BASE_SEPOLIA ? "Base Sepolia" : "Base";

      const from = await requestAccount(provider);

      // Builder code dataSuffix (ERC-8021)
      const dataSuffix = Attribution.toDataSuffix({ codes: [BUILDER_CODE] });

      // Build USDC transfer call
      const usdc = USDC_MAINNET; // (keep simple: mainnet only)
      const data = encodeErc20Transfer(RECIPIENT, amount);

      // Strict schema to avoid "Invalid request params[0].chainId is a required field"
      setTipState("sending");
      const result = await provider.request({
        method: "wallet_sendCalls",
        params: [{
          version: SENDCALLS_VERSION,
          from,
          chainId,
          atomicRequired: true,
          calls: [{
            to: usdc,
            value: "0x0",
            data
          }],
          capabilities: {
            dataSuffix
          }
        }]
      });

      // Wallet UI will block the screen; when it returns, we can animate + toast.
      setTipState("done");
      setStatus("");
      closeSheet();
      showToast("Thank you for the warmth 💗");
      try { window.__BR_UI__?.pulseBoost?.(900); } catch {}
      console.log("wallet_sendCalls result:", result);
    } catch (err) {
      console.error(err);
      const msg = (err && err.message) ? err.message : String(err);

      // Gentle fallback on rejection
      if (/rejected|denied|user/i.test(msg)) {
        setStatus("Tip canceled.");
        setTipState("select");
        showToast("No worries — maybe later ✨");
        return;
      }

      setStatus(msg);
      setTipState("select");
    }
  });
});
