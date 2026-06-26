const packages = [
  {
    id: "starter",
    name: "Starter Studio",
    label: "For new client onboarding",
    price: 24999,
    duration: "30 days setup",
    includes: ["Package setup", "Client intake form", "Payment checkout", "Email confirmation"]
  },
  {
    id: "growth",
    name: "Growth Studio",
    label: "Most selected",
    price: 49999,
    duration: "45 days setup",
    includes: ["Everything in Starter", "Quotation setup", "Razorpay integration", "Priority onboarding"]
  },
  {
    id: "enterprise",
    name: "Enterprise Studio",
    label: "For custom teams",
    price: 89999,
    duration: "60 days setup",
    includes: ["Everything in Growth", "Dedicated setup manager", "Advanced support", "Custom account setup"]
  }
];

const STORAGE_KEY = "tcs-order";
// The Express server serves these static pages and /api from the same origin in
// production. The "npm run static" workflow serves this page on a separate port
// (4173) for local testing, so fall back to the known backend port on localhost.
const API_BASE = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ? `${window.location.protocol}//${window.location.hostname}:5000/api`
  : `${window.location.origin}/api`;

const defaultOrder = {
  selectedPackageId: "growth",
  customer: {},
  verified: { phone: false, email: false },
  otpSent: { phone: false, email: false },
  coupon: null,
  paymentStatus: "pending",
  workspaceCreated: false
};

function loadOrder() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    const queryPackage = new URLSearchParams(window.location.search).get("package");
    const selectedPackageId = packages.some((pkg) => pkg.id === queryPackage)
      ? queryPackage
      : saved.selectedPackageId;
    return {
      ...defaultOrder,
      ...saved,
      selectedPackageId: selectedPackageId || defaultOrder.selectedPackageId,
      // Verification never survives a page refresh — always start unverified so
      // the user must re-send and re-verify the OTP each time the tab reloads.
      verified: { ...defaultOrder.verified },
      otpSent: { ...defaultOrder.otpSent },
      otpVia: {},
      coupon: saved.coupon || null
    };
  } catch {
    return { ...defaultOrder };
  }
}

function saveOrder(order) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
}

let order = loadOrder();
const page = document.body.dataset.page;

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed." }));
    throw new Error(error.message || "Request failed.");
  }

  return response.json();
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value);
}

let toastTimer;
function showToast(message, type = "error") {
  let toast = document.getElementById("appToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "appToast";
    document.body.appendChild(toast);
  }
  toast.className = `app-toast app-toast-${type}`;
  toast.textContent = message;
  // Re-trigger the transition even if the same message fires twice in a row.
  requestAnimationFrame(() => toast.classList.add("is-visible"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 4200);
}

// ISO country codes paired with their dial code; flags are derived from the
// ISO code so this list doesn't need to carry emoji literals.
const COUNTRY_DIAL_CODES = [
  ["IN", "India", "+91"], ["US", "United States", "+1"], ["GB", "United Kingdom", "+44"],
  ["AU", "Australia", "+61"], ["AE", "United Arab Emirates", "+971"], ["SG", "Singapore", "+65"],
  ["MY", "Malaysia", "+60"], ["DE", "Germany", "+49"], ["FR", "France", "+33"], ["JP", "Japan", "+81"],
  ["AF", "Afghanistan", "+93"], ["AL", "Albania", "+355"], ["DZ", "Algeria", "+213"], ["AD", "Andorra", "+376"],
  ["AO", "Angola", "+244"], ["AR", "Argentina", "+54"], ["AM", "Armenia", "+374"], ["AT", "Austria", "+43"],
  ["AZ", "Azerbaijan", "+994"], ["BH", "Bahrain", "+973"], ["BD", "Bangladesh", "+880"], ["BY", "Belarus", "+375"],
  ["BE", "Belgium", "+32"], ["BZ", "Belize", "+501"], ["BJ", "Benin", "+229"], ["BT", "Bhutan", "+975"],
  ["BO", "Bolivia", "+591"], ["BA", "Bosnia and Herzegovina", "+387"], ["BW", "Botswana", "+267"],
  ["BR", "Brazil", "+55"], ["BN", "Brunei", "+673"], ["BG", "Bulgaria", "+359"], ["BF", "Burkina Faso", "+226"],
  ["BI", "Burundi", "+257"], ["KH", "Cambodia", "+855"], ["CM", "Cameroon", "+237"], ["CA", "Canada", "+1"],
  ["CL", "Chile", "+56"], ["CN", "China", "+86"], ["CO", "Colombia", "+57"], ["CR", "Costa Rica", "+506"],
  ["HR", "Croatia", "+385"], ["CU", "Cuba", "+53"], ["CY", "Cyprus", "+357"], ["CZ", "Czech Republic", "+420"],
  ["DK", "Denmark", "+45"], ["DO", "Dominican Republic", "+1809"], ["EC", "Ecuador", "+593"], ["EG", "Egypt", "+20"],
  ["SV", "El Salvador", "+503"], ["EE", "Estonia", "+372"], ["ET", "Ethiopia", "+251"], ["FJ", "Fiji", "+679"],
  ["FI", "Finland", "+358"], ["GE", "Georgia", "+995"], ["GH", "Ghana", "+233"], ["GR", "Greece", "+30"],
  ["GT", "Guatemala", "+502"], ["HN", "Honduras", "+504"], ["HK", "Hong Kong", "+852"], ["HU", "Hungary", "+36"],
  ["IS", "Iceland", "+354"], ["ID", "Indonesia", "+62"], ["IR", "Iran", "+98"], ["IQ", "Iraq", "+964"],
  ["IE", "Ireland", "+353"], ["IL", "Israel", "+972"], ["IT", "Italy", "+39"], ["JM", "Jamaica", "+1876"],
  ["JO", "Jordan", "+962"], ["KZ", "Kazakhstan", "+7"], ["KE", "Kenya", "+254"], ["KW", "Kuwait", "+965"],
  ["KG", "Kyrgyzstan", "+996"], ["LA", "Laos", "+856"], ["LV", "Latvia", "+371"], ["LB", "Lebanon", "+961"],
  ["LS", "Lesotho", "+266"], ["LY", "Libya", "+218"], ["LI", "Liechtenstein", "+423"], ["LT", "Lithuania", "+370"],
  ["LU", "Luxembourg", "+352"], ["MO", "Macau", "+853"], ["MG", "Madagascar", "+261"], ["MW", "Malawi", "+265"],
  ["MV", "Maldives", "+960"], ["ML", "Mali", "+223"], ["MT", "Malta", "+356"], ["MU", "Mauritius", "+230"],
  ["MX", "Mexico", "+52"], ["MD", "Moldova", "+373"], ["MC", "Monaco", "+377"], ["MN", "Mongolia", "+976"],
  ["ME", "Montenegro", "+382"], ["MA", "Morocco", "+212"], ["MZ", "Mozambique", "+258"], ["MM", "Myanmar", "+95"],
  ["NA", "Namibia", "+264"], ["NP", "Nepal", "+977"], ["NL", "Netherlands", "+31"], ["NZ", "New Zealand", "+64"],
  ["NI", "Nicaragua", "+505"], ["NE", "Niger", "+227"], ["NG", "Nigeria", "+234"], ["KP", "North Korea", "+850"],
  ["MK", "North Macedonia", "+389"], ["NO", "Norway", "+47"], ["OM", "Oman", "+968"], ["PK", "Pakistan", "+92"],
  ["PA", "Panama", "+507"], ["PG", "Papua New Guinea", "+675"], ["PY", "Paraguay", "+595"], ["PE", "Peru", "+51"],
  ["PH", "Philippines", "+63"], ["PL", "Poland", "+48"], ["PT", "Portugal", "+351"], ["QA", "Qatar", "+974"],
  ["RO", "Romania", "+40"], ["RU", "Russia", "+7"], ["RW", "Rwanda", "+250"], ["SA", "Saudi Arabia", "+966"],
  ["SN", "Senegal", "+221"], ["RS", "Serbia", "+381"], ["SK", "Slovakia", "+421"], ["SI", "Slovenia", "+386"],
  ["SO", "Somalia", "+252"], ["ZA", "South Africa", "+27"], ["KR", "South Korea", "+82"], ["SS", "South Sudan", "+211"],
  ["ES", "Spain", "+34"], ["LK", "Sri Lanka", "+94"], ["SD", "Sudan", "+249"], ["SE", "Sweden", "+46"],
  ["CH", "Switzerland", "+41"], ["SY", "Syria", "+963"], ["TW", "Taiwan", "+886"], ["TJ", "Tajikistan", "+992"],
  ["TZ", "Tanzania", "+255"], ["TH", "Thailand", "+66"], ["TG", "Togo", "+228"], ["TT", "Trinidad and Tobago", "+1868"],
  ["TN", "Tunisia", "+216"], ["TR", "Turkey", "+90"], ["TM", "Turkmenistan", "+993"], ["UG", "Uganda", "+256"],
  ["UA", "Ukraine", "+380"], ["UY", "Uruguay", "+598"], ["UZ", "Uzbekistan", "+998"], ["VE", "Venezuela", "+58"],
  ["VN", "Vietnam", "+84"], ["YE", "Yemen", "+967"], ["ZM", "Zambia", "+260"], ["ZW", "Zimbabwe", "+263"]
].map(([iso, name, dial]) => ({
  iso,
  name,
  dial,
  flag: String.fromCodePoint(...[...iso].map((c) => 127397 + c.charCodeAt(0)))
}));

function setupCountryPicker() {
  const picker = document.querySelector("[data-country-picker]");
  if (!picker) return;

  const trigger = picker.querySelector("[data-country-trigger]");
  const menu = picker.querySelector("[data-country-menu]");
  const search = picker.querySelector("[data-country-search]");
  const list = picker.querySelector("[data-country-list]");
  const hiddenInput = document.getElementById("customerCountryCode");
  const flagEl = picker.querySelector("[data-country-flag]");
  const dialEl = picker.querySelector("[data-country-dial]");

  function syncTrigger() {
    const current = COUNTRY_DIAL_CODES.find((c) => c.dial === hiddenInput.value) || COUNTRY_DIAL_CODES[0];
    flagEl.textContent = current.flag;
    dialEl.textContent = current.dial;
  }

  function renderList(query) {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? COUNTRY_DIAL_CODES.filter((c) => `${c.name} ${c.dial}`.toLowerCase().includes(q))
      : COUNTRY_DIAL_CODES;

    list.innerHTML = filtered.length
      ? filtered.map((c) => `
          <button type="button" class="country-picker-option${c.dial === hiddenInput.value ? " is-active" : ""}" data-dial="${c.dial}">
            <span>${c.flag} ${c.name}</span>
            <span class="country-picker-dial">${c.dial}</span>
          </button>
        `).join("")
      : `<p class="country-picker-empty">No matches</p>`;
  }

  function openMenu() {
    menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    search.value = "";
    renderList("");
    search.focus();
  }

  function closeMenu() {
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  }

  trigger.addEventListener("click", () => {
    if (menu.hidden) openMenu();
    else closeMenu();
  });

  search.addEventListener("input", () => renderList(search.value));

  list.addEventListener("click", (event) => {
    const option = event.target.closest("[data-dial]");
    if (!option) return;
    hiddenInput.value = option.dataset.dial;
    hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
    syncTrigger();
    closeMenu();
  });

  document.addEventListener("click", (event) => {
    if (!picker.contains(event.target)) closeMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  syncTrigger();
}

function selectedPackage() {
  return packages.find((item) => item.id === order.selectedPackageId) || packages[1];
}

function customerFullPhone() {
  const code = order.customer.customerCountryCode || "+91";
  const number = order.customer.customerPhone || "";
  return number ? `${code} ${number}` : "";
}

// Maharashtra state code — The Copper Studio's registered state.
// GSTIN starts with the 2-digit state code of the buyer's state.
const SELLER_STATE_CODE = "27";

function gstType(gstin) {
  const code = String(gstin || "").trim().replace(/\s/g, "").slice(0, 2);
  if (code.length < 2 || !/^\d{2}$/.test(code)) return "b2c"; // no valid GSTIN → B2C
  return code === SELLER_STATE_CODE ? "intra" : "inter";
}

function gstBreakdownHtml(gst, gstin) {
  const type = gstType(gstin);
  if (type === "intra") {
    const cgst = Math.floor(gst / 2);
    const sgst = gst - cgst;
    return `
      <div class="overview-row"><span>CGST (9%)</span><strong>${formatCurrency(cgst)}</strong></div>
      <div class="overview-row"><span>SGST (9%)</span><strong>${formatCurrency(sgst)}</strong></div>`;
  }
  if (type === "inter") {
    return `<div class="overview-row"><span>IGST (18%)</span><strong>${formatCurrency(gst)}</strong></div>`;
  }
  return `<div class="overview-row"><span>GST estimate (18%)</span><strong>${formatCurrency(gst)}</strong></div>`;
}

function packageTotal(pkg = selectedPackage()) {
  const discount = order.coupon?.discount || 0;
  return Math.round(Math.max(0, pkg.price - discount) * 1.18);
}

function packageGst(pkg = selectedPackage()) {
  const discount = order.coupon?.discount || 0;
  return Math.round(Math.max(0, pkg.price - discount) * 0.18);
}

function overviewTemplate(pkg = selectedPackage(), gstin = "") {
  const discount = order.coupon?.discount || 0;
  const subtotal = Math.max(0, pkg.price - discount);
  const gst = Math.round(subtotal * 0.18);
  return `
    <div class="overview-card">
      <h3>${pkg.name}</h3>
      <p>${pkg.label}</p>
      <div class="overview-row"><span>Package amount</span><strong>${formatCurrency(pkg.price)}</strong></div>
      ${discount ? `<div class="overview-row discount-row"><span>Coupon discount (${order.coupon.code})</span><strong>- ${formatCurrency(discount)}</strong></div>` : ""}
      <div class="overview-row"><span>Taxable subtotal</span><strong>${formatCurrency(subtotal)}</strong></div>
      ${gstBreakdownHtml(gst, gstin)}
      <div class="overview-row"><span>Setup timeline</span><strong>${pkg.duration}</strong></div>
      <div class="overview-row"><span>Confirmation</span><strong>Email after payment</strong></div>
    </div>
  `;
}

// Left panel on the payment page: the selected package, its setup timeline,
// what's included, and any add-ons that have been attached to the order.
function packageDetailsTemplate(pkg = selectedPackage()) {
  const includes = pkg.includes || [];
  const addOns = order.addOns || pkg.addOns || [];
  return `
    <div class="overview-card">
      <h3>${pkg.name}</h3>
      <p>${pkg.label}</p>
      <div class="overview-row"><span>Package amount</span><strong>${formatCurrency(pkg.price)}</strong></div>
      <div class="overview-row"><span>Setup timeline</span><strong>${pkg.duration}</strong></div>
      ${includes.length ? `
        <p class="mini-label" style="margin-top:16px">What's included</p>
        <ul class="package-includes">${includes.map((item) => `<li>${item}</li>`).join("")}</ul>` : ""}
      ${addOns.length ? `
        <p class="mini-label" style="margin-top:16px">Add-ons</p>
        <ul class="package-includes">${addOns.map((a) => `<li>${a.name || a}${a.price ? `<span>${formatCurrency(a.price)}</span>` : ""}</li>`).join("")}</ul>` : ""}
    </div>
  `;
}

// Right panel on the payment page: the amount breakdown with GST type based on
// the buyer's GSTIN state code vs the seller's state (27 = Maharashtra).
function amountBreakdownTemplate(pkg = selectedPackage()) {
  const discount = order.coupon?.discount || 0;
  const subtotal = Math.max(0, pkg.price - discount);
  const total = packageTotal(pkg);
  const gst = total - subtotal;
  const gstin = order.customer?.companyGstin || "";
  return `
    <div class="overview-card">
      <div class="overview-row"><span>Package amount</span><strong>${formatCurrency(pkg.price)}</strong></div>
      ${discount ? `<div class="overview-row discount-row"><span>Coupon applied (${order.coupon.code})</span><strong>- ${formatCurrency(discount)}</strong></div>` : ""}
      <div class="overview-row"><span>Taxable subtotal</span><strong>${formatCurrency(subtotal)}</strong></div>
      ${gstBreakdownHtml(gst, gstin)}
    </div>
    <div class="summary-divider"></div>
    <div class="total-row"><span>Amount to pay</span><strong>${formatCurrency(total)}</strong></div>
  `;
}

function requirePackage() {
  if (!order.selectedPackageId) {
    window.location.href = "index.html";
  }
}

function requireCustomer() {
  requirePackage();
  if (!order.customer.firstName || !order.verified.phone || !order.verified.email) {
    window.location.href = "checkout.html";
  }
}

function renderPackagesPage() {
  const packageGrid = document.getElementById("packageGrid");
  packageGrid.innerHTML = packages
    .map((pkg) => {
      const isSelected = pkg.id === order.selectedPackageId;
      return `
        <article class="package-card ${isSelected ? "is-selected" : ""}">
          <header>
            <div>
              <p class="mini-label">${pkg.label}</p>
              <h3>${pkg.name}</h3>
            </div>
            <span class="material-symbols-outlined">${isSelected ? "radio_button_checked" : "radio_button_unchecked"}</span>
          </header>
          <div class="price">${formatCurrency(pkg.price)}</div>
          <p>${pkg.duration}</p>
          <ul>${pkg.includes.map((item) => `<li>${item}</li>`).join("")}</ul>
          <button class="btn ${isSelected ? "btn-primary" : "btn-secondary"}" type="button" data-package="${pkg.id}">
            ${isSelected ? "Continue with Package" : "Select Package"}
          </button>
        </article>
      `;
    })
    .join("");

  packageGrid.querySelectorAll("[data-package]").forEach((button) => {
    button.addEventListener("click", () => {
      order = {
        ...defaultOrder,
        selectedPackageId: button.dataset.package,
        customer: order.customer || {},
        coupon: null
      };
      saveOrder(order);
      window.location.href = "checkout.html";
    });
  });
}

function updateVerificationUI() {
  Object.entries(order.verified).forEach(([type, verified]) => {
    const status = document.getElementById(`${type}VerifyStatus`);
    const card = document.querySelector(`[data-verify-card="${type}"]`);
    const button = document.querySelector(`[data-verify="${type}"]`);
    const sendButton = document.querySelector(`[data-send-otp="${type}"]`);
    const input = document.querySelector(`[data-otp-input="${type}"]`);
    const sent = order.otpSent?.[type];
    const via = order.otpVia?.[type] === "sms" ? "Check your SMS inbox." : "Check your email.";

    if (!status || !card || !button || !sendButton || !input) return;

    status.textContent = verified ? "Verified" : sent ? `OTP sent. ${via}` : "OTP not sent";
    button.textContent = verified ? "Verified" : "Verify";
    button.disabled = !sent || verified;
    sendButton.disabled = verified;
    input.disabled = !sent || verified;
    card.classList.toggle("is-sent", sent && !verified);
    card.classList.toggle("is-verified", verified);
  });
}

function renderCheckoutPage() {
  requirePackage();
  const pkg = selectedPackage();
  const gstinInput = document.getElementById("companyGstin");

  function refreshSummary() {
    const gstin = gstinInput?.value || "";
    document.getElementById("selectedOverview").innerHTML = overviewTemplate(pkg, gstin);
    document.getElementById("overviewTotal").textContent = formatCurrency(packageTotal(pkg));
  }

  refreshSummary();
  gstinInput?.addEventListener("input", refreshSummary);

  const couponInput = document.getElementById("couponCode");
  const couponStatus = document.getElementById("couponStatus");
  if (couponInput && order.coupon?.code) {
    couponInput.value = order.coupon.code;
    couponStatus.textContent = `${order.coupon.code} applied. You saved ${formatCurrency(order.coupon.discount)}.`;
    couponStatus.className = "coupon-success";
  }

  Object.entries(order.customer || {}).forEach(([key, value]) => {
    const input = document.querySelector(`[name="${key}"]`);
    if (input) input.value = value;
  });

  setupCountryPicker();

  const phoneInput = document.getElementById("customerPhone");
  if (phoneInput) {
    phoneInput.addEventListener("input", () => {
      phoneInput.value = phoneInput.value.replace(/\D/g, "").slice(0, 10);
    });
  }

  updateVerificationUI();

  document.getElementById("applyCouponButton")?.addEventListener("click", async () => {
    const code = couponInput.value.trim().toUpperCase();
    if (!code) {
      order.coupon = null;
      saveOrder(order);
      refreshSummary();
      couponStatus.textContent = "Coupon removed.";
      couponStatus.className = "";
      return;
    }

    couponStatus.textContent = "Checking coupon...";
    couponStatus.className = "";
    try {
      const applied = await apiRequest("/coupons/validate", {
        method: "POST",
        body: JSON.stringify({ code, selectedPackageId: order.selectedPackageId })
      });
      order.coupon = {
        code: applied.code,
        amount: applied.amount,
        amountType: applied.amountType,
        discount: applied.discount,
        subtotal: applied.subtotal,
        gst: applied.gst,
        total: applied.total
      };
      saveOrder(order);
      refreshSummary();
      couponStatus.textContent = `${applied.code} applied. You saved ${formatCurrency(applied.discount)}.`;
      couponStatus.className = "coupon-success";
    } catch (error) {
      order.coupon = null;
      saveOrder(order);
      refreshSummary();
      couponStatus.textContent = error.message;
      couponStatus.className = "coupon-error";
    }
  });

  document.querySelectorAll("[data-send-otp]").forEach((button) => {
    button.addEventListener("click", async () => {
      const type = button.dataset.sendOtp;
      const field = document.getElementById(type === "phone" ? "customerPhone" : "customerEmail");
      if (!field.reportValidity()) return;

      const emailField = document.getElementById("customerEmail");
      if (!emailField.reportValidity()) return;

      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = "Sending...";
      try {
        const phoneField = document.getElementById("customerPhone");
        const dialCode = document.getElementById("customerCountryCode")?.value || "+91";
        const result = await apiRequest("/otp/send", {
          method: "POST",
          body: JSON.stringify({
            email: emailField.value.trim(),
            channel: type,
            ...(type === "phone" ? { phone: phoneField.value.trim(), dialCode } : {})
          })
        });

        if (!result.sent && !result.devCode) {
          showToast(`We couldn't send the OTP ${result.via === "sms" ? "SMS" : "email"} right now. Please try again in a moment or contact support.`);
          return;
        }

        order.otpSent = { ...defaultOrder.otpSent, ...(order.otpSent || {}) };
        order.otpSent[type] = true;
        order.otpVia = { ...(order.otpVia || {}), [type]: result.via };
        order.verified[type] = false;
        saveOrder(order);
        updateVerificationUI();
        if (result.devCode) {
          console.info(`[dev only] OTP for ${type}:`, result.devCode);
        }
      } catch (error) {
        showToast(error.message);
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    });
  });

  document.querySelectorAll("[data-verify]").forEach((button) => {
    button.addEventListener("click", async () => {
      const type = button.dataset.verify;
      const input = document.querySelector(`[data-otp-input="${type}"]`);
      const code = input.value.trim();
      if (!code) {
        showToast("Please enter the OTP that was sent to you.");
        return;
      }

      const emailField = document.getElementById("customerEmail");
      button.disabled = true;
      try {
        await apiRequest("/otp/verify", {
          method: "POST",
          body: JSON.stringify({ email: emailField.value.trim(), channel: type, code })
        });
        order.verified[type] = true;
        saveOrder(order);
        updateVerificationUI();
        showToast(`${type === "phone" ? "Mobile number" : "Email"} verified.`, "success");
      } catch (error) {
        input.value = "";
        showToast(error.message);
      } finally {
        button.disabled = false;
      }
    });
  });

  document.getElementById("customerForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;

    if (!order.verified.phone || !order.verified.email) {
      showToast("Please verify both mobile number and email OTP before continuing to Razorpay.");
      return;
    }

    const formValues = Object.fromEntries(new FormData(form).entries());
    order.customer = {
      ...formValues,
      customerName: `${formValues.firstName} ${formValues.lastName}`.trim()
    };
    saveOrder(order);

    try {
      await apiRequest("/leads", {
        method: "POST",
        body: JSON.stringify({
          ...order.customer,
          selectedPackageId: order.selectedPackageId
        })
      });
    } catch (error) {
      console.warn("Lead save failed:", error.message);
    }

    window.location.href = "payment.html";
  });
}

function renderPaymentPage() {
  requireCustomer();
  const pkg = selectedPackage();
  document.getElementById("packageDetails").innerHTML = packageDetailsTemplate(pkg);
  document.getElementById("amountBreakdown").innerHTML = amountBreakdownTemplate(pkg);
  document.getElementById("summaryCustomer").textContent = order.customer.customerName;
  document.getElementById("summaryContact").textContent = `${order.customer.customerEmail} | ${customerFullPhone()}`;

  document.getElementById("payButton").addEventListener("click", async () => {
    const button = document.getElementById("payButton");
    const gatewayNote = document.getElementById("gatewayNote");
    button.disabled = true;
    button.textContent = "Opening Razorpay...";
    if (gatewayNote) gatewayNote.textContent = "Creating secure Razorpay order...";

    try {
      if (!window.Razorpay) {
        throw new Error("Razorpay Checkout script did not load. Check your internet connection.");
      }

      const [{ keyId }, razorpayOrder] = await Promise.all([
        apiRequest("/razorpay/config"),
        apiRequest("/razorpay/order", {
          method: "POST",
          body: JSON.stringify({ selectedPackageId: order.selectedPackageId, couponCode: order.coupon?.code || "" })
        })
      ]);

      const options = {
        key: keyId,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        name: "The Copper Studio",
        description: `${pkg.name} package`,
        order_id: razorpayOrder.id,
        prefill: {
          name: order.customer.customerName,
          email: order.customer.customerEmail,
          contact: customerFullPhone()
        },
        notes: {
          packageId: pkg.id,
          packageName: pkg.name
        },
        theme: {
          color: "#884c2d"
        },
        handler: async (response) => {
          button.textContent = "Verifying payment...";
          if (gatewayNote) gatewayNote.textContent = "Verifying payment with Razorpay...";

          const savedOrder = await apiRequest("/razorpay/verify", {
            method: "POST",
            body: JSON.stringify({
              ...response,
              selectedPackageId: order.selectedPackageId,
              couponCode: order.coupon?.code || "",
              customer: order.customer,
              verified: order.verified
            })
          });

          order.paymentStatus = "paid";
          order.paidAt = savedOrder.payment.paidAt;
          order.invoiceId = savedOrder.payment.invoiceId;
          order.razorpayOrderId = savedOrder.payment.razorpayOrderId;
          order.razorpayPaymentId = savedOrder.payment.razorpayPaymentId;
          order.mongoOrderId = savedOrder._id;
          saveOrder(order);
          window.location.href = "success.html";
        },
        modal: {
          ondismiss: () => {
            button.disabled = false;
            button.innerHTML = 'Pay Securely <span class="material-symbols-outlined">arrow_forward</span>';
            if (gatewayNote) gatewayNote.textContent = "Payment was cancelled. You can try again.";
          }
        }
      };

      const checkout = new window.Razorpay(options);
      checkout.on("payment.failed", (response) => {
        button.disabled = false;
        button.innerHTML = 'Pay Securely <span class="material-symbols-outlined">arrow_forward</span>';
        if (gatewayNote) {
          gatewayNote.textContent = response.error?.description || "Payment failed. Please try again.";
        }
      });
      checkout.open();
    } catch (error) {
      console.error(error);
      button.disabled = false;
      button.innerHTML = 'Pay Securely <span class="material-symbols-outlined">arrow_forward</span>';
      if (gatewayNote) gatewayNote.textContent = error.message;
      showToast(error.message);
    }
  });
}

function renderSuccessPage() {
  requireCustomer();
  if (order.paymentStatus !== "paid") {
    window.location.href = "payment.html";
    return;
  }

  const pkg = selectedPackage();
  document.getElementById("successMessage").textContent =
    `Payment for ${pkg.name} is confirmed. Invoice ${order.invoiceId} is generated, and a mail has been sent to ${order.customer.customerEmail} for the next process. Please open that email to set up your portal password and continue onboarding.`;

  const downloadBtn = document.getElementById("downloadInvoice");
  if (downloadBtn) {
    if (order.mongoOrderId) {
      downloadBtn.addEventListener("click", () => {
        window.open(`${API_BASE}/invoices/by-order/${order.mongoOrderId}/pdf`, "_blank", "noopener");
      });
    } else {
      downloadBtn.disabled = true;
    }
  }
}

const agencyProjects = [
  {
    client: "ABC Pvt Ltd",
    name: "CRM Development",
    progress: 68,
    due: "20 Jun 2026",
    status: "In Progress",
    manager: "Rohit",
    team: ["R", "J", "S"],
    budget: 76770
  },
  {
    client: "XYZ Pvt Ltd",
    name: "Website Redesign",
    progress: 42,
    due: "30 Jun 2026",
    status: "In Progress",
    manager: "John",
    team: ["R", "J"],
    budget: 46375
  },
  {
    client: "PQR Pvt Ltd",
    name: "Mobile App",
    progress: 20,
    due: "15 Jul 2026",
    status: "Planning",
    manager: "Sarah",
    team: ["S", "R"],
    budget: 89499
  },
  {
    client: "LMN Corp",
    name: "Custom Software",
    progress: 75,
    due: "25 Jun 2026",
    status: "Review",
    manager: "Rohit",
    team: ["R", "A", "J"],
    budget: 120000
  }
];

const kanbanColumns = [
  {
    title: "Backlog",
    tasks: [
      { name: "User Authentication", project: "CRM Development", priority: "High", owner: "Rohit", due: "18 Jun" },
      { name: "Database Design", project: "CRM Development", priority: "Medium", owner: "John", due: "20 Jun" },
      { name: "API Documentation", project: "CRM Development", priority: "Low", owner: "Sarah", due: "24 Jun" }
    ]
  },
  {
    title: "To Do",
    tasks: [
      { name: "Dashboard UI", project: "CRM Development", priority: "High", owner: "Rohit", due: "21 Jun" },
      { name: "Role Management", project: "CRM Development", priority: "Medium", owner: "John", due: "23 Jun" },
      { name: "Email Integration", project: "CRM Development", priority: "Medium", owner: "Sarah", due: "25 Jun" }
    ]
  },
  {
    title: "In Progress",
    tasks: [
      { name: "Lead Management", project: "CRM Development", priority: "High", owner: "Rohit", due: "19 Jun" },
      { name: "Contact Module", project: "CRM Development", priority: "Medium", owner: "John", due: "22 Jun" }
    ]
  },
  {
    title: "Review",
    tasks: [
      { name: "Deal Pipeline", project: "CRM Development", priority: "Medium", owner: "Rohit", due: "Today" },
      { name: "Report Module", project: "CRM Development", priority: "Low", owner: "John", due: "Tomorrow" }
    ]
  },
  {
    title: "Completed",
    tasks: [
      { name: "Project Setup", project: "CRM Development", priority: "Done", owner: "Rohit", due: "10 Jun" },
      { name: "Requirements Gathering", project: "CRM Development", priority: "Done", owner: "Sarah", due: "12 Jun" },
      { name: "UX/UI Design", project: "CRM Development", priority: "Done", owner: "Sarah", due: "14 Jun" }
    ]
  }
];

function teamAvatars(team) {
  return team.map((member) => `<span class="avatar">${member}</span>`).join("");
}

function projectCardTemplate(project) {
  return `
    <article class="ops-card project-card">
      <div class="card-topline">
        <div>
          <p class="mini-label">${project.client}</p>
          <h3>${project.name}</h3>
        </div>
        <span class="status-pill">${project.status}</span>
      </div>
      <div class="progress-circle" style="--value:${project.progress}"><strong>${project.progress}%</strong></div>
      <div class="thin-progress"><span style="width:${project.progress}%"></span></div>
      <div class="project-meta">
        <span>Due ${project.due}</span>
        <span>${project.manager}</span>
      </div>
      <div class="avatar-row">${teamAvatars(project.team)}</div>
    </article>
  `;
}

function renderOpsOverview(root) {
  root.innerHTML = `
    <section class="metric-grid">
      <article class="metric-card"><span>Total Revenue</span><strong>${formatCurrency(324560)}</strong><small>+18.2% from last month</small></article>
      <article class="metric-card"><span>Active Projects</span><strong>12</strong><small>2 due this week</small></article>
      <article class="metric-card"><span>New Purchases</span><strong>48</strong><small>Package orders received</small></article>
      <article class="metric-card"><span>Pending Payments</span><strong>${formatCurrency(48450)}</strong><small>Needs follow-up</small></article>
    </section>
    <section class="ops-grid">
      <div class="ops-panel wide-panel">
        <div class="section-title"><h2>Priority Projects</h2><span>This week</span></div>
        <div class="project-grid">${agencyProjects.map(projectCardTemplate).join("")}</div>
      </div>
      <div class="ops-panel">
        <div class="section-title"><h2>Recent Orders</h2><span>Live</span></div>
        ${agencyProjects.slice(0, 3).map((project, index) => `
          <div class="activity-row">
            <strong>#ORD-${1258 - index}</strong>
            <span>${project.client}</span>
            <b>${formatCurrency(project.budget)}</b>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderOpsProjects(root) {
  root.innerHTML = `
    <section class="ops-panel">
      <div class="section-title"><h2>Active Projects</h2><button class="small-action" type="button">New Project</button></div>
      <div class="project-grid">${agencyProjects.map(projectCardTemplate).join("")}</div>
    </section>
    <section class="ops-panel">
      <div class="project-table">
        <div class="table-row table-head"><span>Project</span><span>Client</span><span>Due</span><span>Progress</span><span>Status</span></div>
        ${agencyProjects.map((project) => `
          <div class="table-row">
            <strong>${project.name}</strong>
            <span>${project.client}</span>
            <span>${project.due}</span>
            <span><i class="table-progress"><em style="width:${project.progress}%"></em></i>${project.progress}%</span>
            <span class="status-pill">${project.status}</span>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderOpsKanban(root) {
  root.innerHTML = `
    <section class="kanban-toolbar">
      <div>
        <h2>Project Kanban</h2>
        <p>Simple task movement board for delivery work.</p>
      </div>
      <button class="small-action" type="button">Add Task</button>
    </section>
    <section class="kanban-board" aria-label="Project task board">
      ${kanbanColumns.map((column) => `
        <div class="kanban-column">
          <header><strong>${column.title}</strong><span>${column.tasks.length}</span></header>
          <div class="kanban-stack">
            ${column.tasks.map((task) => `
              <article class="task-card">
                <h3>${task.name}</h3>
                <p>${task.project}</p>
                <div class="task-meta">
                  <span class="priority-${task.priority.toLowerCase()}">${task.priority}</span>
                  <span>${task.owner}</span>
                  <span>${task.due}</span>
                </div>
              </article>
            `).join("")}
          </div>
        </div>
      `).join("")}
    </section>
  `;
}

function renderOpsInvoice(root) {
  const subtotal = 80000;
  const gst = Math.round(subtotal * 0.18);
  root.innerHTML = `
    <section class="invoice-preview">
      <div class="invoice-paper">
        <div class="invoice-head">
          <strong>The Copper Studio</strong>
          <span class="status-pill">Paid</span>
        </div>
        <p>123, Creative Street, Pune, Maharashtra</p>
        <div class="invoice-meta">
          <span>Invoice No: INV-2026-058</span>
          <span>Due Date: 05 Jun 2026</span>
        </div>
        <h2>ABC Pvt Ltd</h2>
        <div class="project-table">
          <div class="table-row table-head"><span>Item</span><span>Description</span><span>Amount</span></div>
          <div class="table-row"><span>1</span><span>Enterprise CRM Development</span><strong>${formatCurrency(76270)}</strong></div>
          <div class="table-row"><span>2</span><span>UI/UX Design</span><strong>${formatCurrency(8475)}</strong></div>
          <div class="table-row"><span>3</span><span>Integration & Testing</span><strong>${formatCurrency(4257)}</strong></div>
        </div>
        <div class="invoice-total">
          <span>Subtotal ${formatCurrency(subtotal)}</span>
          <span>GST ${formatCurrency(gst)}</span>
          <strong>Total ${formatCurrency(subtotal + gst)}</strong>
        </div>
      </div>
    </section>
  `;
}

function renderOpsClient(root) {
  const project = agencyProjects[0];
  root.innerHTML = `
    <section class="client-view">
      <div class="client-hero">
        <p class="mini-label">Client Portal Preview</p>
        <h1>Good Evening, Rohit</h1>
        <p>Your active project is moving well. Next update is scheduled after the review milestone.</p>
      </div>
      <div class="client-grid">
        ${projectCardTemplate(project)}
        <article class="ops-card"><p class="mini-label">Total invoices</p><h3>${formatCurrency(89999)}</h3><span class="status-pill">Paid</span></article>
        <article class="ops-card"><p class="mini-label">Upcoming milestone</p><h3>Testing Phase</h3><p>Starts in 3 days</p></article>
      </div>
      <section class="ops-panel">
        <div class="timeline">
          ${["Requirements Gathering", "UI/UX Design", "Development", "Testing", "Deployment"].map((item, index) => `
            <div class="timeline-row ${index < 3 ? "is-done" : ""}">
              <span></span><strong>${item}</strong><em>${index < 3 ? "Completed" : "Upcoming"}</em>
            </div>
          `).join("")}
        </div>
      </section>
    </section>
  `;
}

function renderAdminPage() {
  const views = {
    overview: renderOpsOverview,
    projects: renderOpsProjects,
    kanban: renderOpsKanban,
    invoice: renderOpsInvoice,
    client: renderOpsClient
  };
  const content = document.getElementById("adminContent");

  Object.entries(views).forEach(([view, render]) => {
    const panel = document.createElement("div");
    panel.className = "admin-view";
    panel.dataset.viewPanel = view;
    render(panel);
    content.appendChild(panel);
  });

  const switchView = (view) => {
    document.querySelectorAll("[data-view]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.view === view);
    });
    document.querySelectorAll("[data-view-panel]").forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.viewPanel === view);
    });
  };

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });

  switchView("kanban");
}

const pageRenderers = {
  packages: renderPackagesPage,
  checkout: renderCheckoutPage,
  payment: renderPaymentPage,
  success: renderSuccessPage,
  admin: renderAdminPage
};

pageRenderers[page]?.();
