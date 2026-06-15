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
const API_BASE = "http://localhost:5000/api";

const defaultOrder = {
  selectedPackageId: "growth",
  customer: {},
  verified: { phone: false, email: false },
  otpSent: { phone: false, email: false },
  paymentStatus: "pending",
  workspaceCreated: false
};

function loadOrder() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    return {
      ...defaultOrder,
      ...saved,
      verified: { ...defaultOrder.verified, ...(saved.verified || {}) },
      otpSent: { ...defaultOrder.otpSent, ...(saved.otpSent || {}) }
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

function selectedPackage() {
  return packages.find((item) => item.id === order.selectedPackageId) || packages[1];
}

function packageTotal(pkg = selectedPackage()) {
  return Math.round(pkg.price * 1.18);
}

function overviewTemplate(pkg = selectedPackage()) {
  const gst = Math.round(pkg.price * 0.18);
  return `
    <div class="overview-card">
      <h3>${pkg.name}</h3>
      <p>${pkg.label}</p>
      <div class="overview-row"><span>Package amount</span><strong>${formatCurrency(pkg.price)}</strong></div>
      <div class="overview-row"><span>GST estimate</span><strong>${formatCurrency(gst)}</strong></div>
      <div class="overview-row"><span>Setup timeline</span><strong>${pkg.duration}</strong></div>
      <div class="overview-row"><span>Confirmation</span><strong>Email after payment</strong></div>
    </div>
  `;
}

function requirePackage() {
  if (!order.selectedPackageId) {
    window.location.href = "index.html";
  }
}

function requireCustomer() {
  requirePackage();
  if (!order.customer.customerName || !order.verified.phone || !order.verified.email) {
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
        customer: order.customer || {}
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

    if (!status || !card || !button || !sendButton || !input) return;

    status.textContent = verified ? "Verified" : sent ? "OTP sent. Use 123456 for demo." : "OTP not sent";
    button.textContent = verified ? "Verified" : "Verify";
    button.disabled = !sent || verified;
    sendButton.disabled = verified;
    input.disabled = !sent || verified;
    if (verified) input.value = "123456";
    card.classList.toggle("is-sent", sent && !verified);
    card.classList.toggle("is-verified", verified);
  });
}

function renderCheckoutPage() {
  requirePackage();
  const pkg = selectedPackage();
  document.getElementById("selectedOverview").innerHTML = overviewTemplate(pkg);
  document.getElementById("overviewTotal").textContent = formatCurrency(packageTotal(pkg));

  Object.entries(order.customer || {}).forEach(([key, value]) => {
    const input = document.querySelector(`[name="${key}"]`);
    if (input) input.value = value;
  });

  updateVerificationUI();

  document.querySelectorAll("[data-send-otp]").forEach((button) => {
    button.addEventListener("click", () => {
      const type = button.dataset.sendOtp;
      const field = document.getElementById(type === "phone" ? "customerPhone" : "customerEmail");
      if (!field.reportValidity()) return;

      order.otpSent = { ...defaultOrder.otpSent, ...(order.otpSent || {}) };
      order.otpSent[type] = true;
      saveOrder(order);
      updateVerificationUI();
    });
  });

  document.querySelectorAll("[data-verify]").forEach((button) => {
    button.addEventListener("click", () => {
      const type = button.dataset.verify;
      const input = document.querySelector(`[data-otp-input="${type}"]`);
      if (!input.value.trim()) {
        alert("Please enter the OTP. Use 123456 for this prototype.");
        return;
      }
      order.verified[type] = true;
      saveOrder(order);
      updateVerificationUI();
    });
  });

  document.getElementById("customerForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;

    if (!order.verified.phone || !order.verified.email) {
      alert("Please verify both mobile number and email OTP before continuing to Razorpay.");
      return;
    }

    order.customer = Object.fromEntries(new FormData(form).entries());
    saveOrder(order);
    window.location.href = "payment.html";
  });
}

function renderPaymentPage() {
  requireCustomer();
  const pkg = selectedPackage();
  document.getElementById("checkoutSummary").innerHTML = overviewTemplate(pkg);
  document.getElementById("paymentAmount").textContent = formatCurrency(packageTotal(pkg));
  document.getElementById("summaryCustomer").textContent = order.customer.customerName;
  document.getElementById("summaryContact").textContent = `${order.customer.customerEmail} | ${order.customer.customerPhone}`;

  document.querySelectorAll("[data-method]").forEach((button) => {
    button.addEventListener("click", () => {
      const method = button.dataset.method;
      document.querySelectorAll("[data-method]").forEach((item) => item.classList.toggle("is-active", item.dataset.method === method));
      document.querySelectorAll("[data-payment-panel]").forEach((panel) => {
        panel.classList.toggle("is-active", panel.dataset.paymentPanel === method);
      });
    });
  });

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
          body: JSON.stringify({ selectedPackageId: order.selectedPackageId })
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
          contact: order.customer.customerPhone
        },
        notes: {
          packageId: pkg.id,
          packageName: pkg.name
        },
        theme: {
          color: "#2563eb"
        },
        handler: async (response) => {
          button.textContent = "Verifying payment...";
          if (gatewayNote) gatewayNote.textContent = "Verifying payment with Razorpay...";

          const savedOrder = await apiRequest("/razorpay/verify", {
            method: "POST",
            body: JSON.stringify({
              ...response,
              selectedPackageId: order.selectedPackageId,
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
      alert(error.message);
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
    `Payment for ${pkg.name} is confirmed. Invoice ${order.invoiceId} and a welcome message will be emailed to ${order.customer.customerEmail}.`;
}

async function loadLatestOrderForAdmin() {
  try {
    const latest = await apiRequest("/orders/latest");
    if (!latest) return;

    order = {
      ...order,
      selectedPackageId: latest.package.id,
      customer: latest.customer,
      verified: {
        phone: latest.verification.phoneVerified,
        email: latest.verification.emailVerified
      },
      paymentStatus: latest.payment.status,
      invoiceId: latest.payment.invoiceId,
      paidAt: latest.payment.paidAt,
      mongoOrderId: latest._id,
      workspaceCreated: latest.workspace.status === "created"
    };
    saveOrder(order);
  } catch (error) {
    console.warn("Could not load latest MongoDB order, using local order:", error.message);
  }
}

async function renderAdminPage() {
  await loadLatestOrderForAdmin();

  const hasOrder = order.paymentStatus === "paid";
  const pkg = selectedPackage();
  const customer = order.customer || {};

  document.getElementById("adminNotification").textContent = hasOrder
    ? `${customer.customerName} purchased ${pkg.name}. Payment captured through Razorpay.`
    : "No recent payment found.";
  document.getElementById("adminClientName").textContent = hasOrder ? customer.customerName : "Customer";
  document.getElementById("adminClientContact").textContent = hasOrder
    ? `${customer.customerEmail} | ${customer.customerPhone}`
    : "Awaiting order";
  document.getElementById("adminPackageName").textContent = hasOrder ? pkg.name : "-";
  document.getElementById("adminPackagePrice").textContent = hasOrder ? formatCurrency(packageTotal(pkg)) : "-";
  document.getElementById("workspaceStatus").textContent = !hasOrder
    ? "Payment pending"
    : order.workspaceCreated
      ? "Workspace created"
      : "Payment captured";
  document.getElementById("workspaceSubstatus").textContent = order.workspaceCreated ? "Client tracking enabled" : "Workspace pending";
  document.getElementById("workspaceTitle").textContent = order.workspaceCreated
    ? `${customer.customerName} Portal Workspace`
    : "Workspace not created yet";
  document.getElementById("workspaceDescription").textContent = order.workspaceCreated
    ? "Client can now track onboarding, project milestones, invoices, and support updates."
    : "Create the project after verifying package and payment details.";

  document.querySelectorAll(".progress-step").forEach((step, index) => {
    step.classList.toggle("is-active", order.workspaceCreated ? index <= 3 : index === 0);
  });

  document.getElementById("createWorkspaceButton").addEventListener("click", async () => {
    if (!hasOrder) {
      alert("No paid client is available yet.");
      return;
    }
    order.workspaceCreated = true;

    if (order.mongoOrderId) {
      try {
        await apiRequest(`/orders/${order.mongoOrderId}/workspace`, { method: "PATCH" });
      } catch (error) {
        console.warn("Workspace update failed in MongoDB, using local state:", error.message);
      }
    }

    saveOrder(order);
    renderAdminPage();
  });
}

const pageRenderers = {
  packages: renderPackagesPage,
  checkout: renderCheckoutPage,
  payment: renderPaymentPage,
  success: renderSuccessPage,
  admin: renderAdminPage
};

pageRenderers[page]?.();
