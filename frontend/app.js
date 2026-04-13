const isProductPage = window.location.pathname === "/product.html";
const banner = document.getElementById("cacheBanner");
const clearBtn = document.getElementById("clearBtn");

clearBtn.addEventListener("click", async () => {
  clearBtn.disabled = true;
  clearBtn.textContent = "Clearing...";

  try {
    if (isProductPage) {
      const params = new URLSearchParams(window.location.search);
      const productId = params.get("id");
      await fetch(`/api/products/${productId}/cache`, { method: "DELETE" });
    } else {
      await fetch("/api/products/cache/all", { method: "DELETE" });
    }

    banner.textContent = "🗑️ Cache Cleared — Reloading...";
    banner.className = "cache-banner miss";

    setTimeout(() => {
      window.location.reload();
    }, 800);
  } catch (err) {
    banner.textContent = "❌ Failed to clear cache";
    clearBtn.disabled = false;
    clearBtn.textContent = "Clear Cache";
  }
});

if (!isProductPage) {
  const grid = document.getElementById("productGrid");

  loadProducts();

  grid.addEventListener("click", async (e) => {
    if (!e.target.classList.contains("delete-btn")) return;
    const id = e.target.dataset.id;
    if (!confirm("Delete this product?")) return;

    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      loadProducts();
    } catch {
      alert("Failed to delete product.");
    }
  });

  document.getElementById("addForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    data.price = Number(data.price);
    data.inStock = data.inStock === "true";

    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      e.target.reset();
      closeModal();
      loadProducts();
    } catch {
      alert("Failed to add product.");
    }
  });
}

function loadProducts() {
  const grid = document.getElementById("productGrid");
  grid.innerHTML = "<p>Loading...</p>";

  fetch("/api/products")
    .then((res) => res.json())
    .then((result) => {
      const products = result.products;

      if (!products) {
        grid.innerHTML = "<p>Failed to load products.</p>";
        return;
      }

      banner.className = "cache-banner";
      if (result.isCached) {
        banner.textContent = `✅ Cache HIT — Served from ${result.source.toUpperCase()}`;
        banner.classList.add("hit");
      } else {
        banner.textContent = `❌ Cache MISS — Fetched from MongoDB`;
        banner.classList.add("miss");
      }

      if (products.length === 0) {
        grid.innerHTML = "<p>No products found.</p>";
        return;
      }

      grid.innerHTML = products
        .map(
          (product) => `
          <div class="product-card">
            <img
              src="${product.imageUrl}"
              alt="${product.name}"
              onerror="this.src='https://via.placeholder.com/400x200?text=No+Image'"
              onclick="goToProduct('${product._id}')"
              style="cursor:pointer"
            />
            <div class="card-body" onclick="goToProduct('${product._id}')" style="cursor:pointer">
              <h3>${product.name}</h3>
              <p class="price">Rs. ${product.price.toLocaleString()}</p>
              <span class="category">${product.category}</span>
            </div>
            <button class="delete-btn" data-id="${product._id}">Delete</button>
          </div>
        `
        )
        .join("");
    })
    .catch(() => {
      grid.innerHTML = "<p>Error loading products.</p>";
    });
}

if (isProductPage) {
  const detail = document.getElementById("productDetail");
  const params = new URLSearchParams(window.location.search);
  const productId = params.get("id");

  if (!productId) {
    detail.innerHTML = "<p>Product not found.</p>";
  } else {
    fetch(`/api/products/${productId}`)
      .then((res) => res.json())
      .then((result) => {
        const p = result.product;

        if (!p) {
          detail.innerHTML = "<p>Product not found.</p>";
          return;
        }

        banner.className = "cache-banner";
        if (result.isCached) {
          banner.textContent = `✅ Cache HIT — Served from ${result.source.toUpperCase()}`;
          banner.classList.add("hit");
        } else {
          banner.textContent = `❌ Cache MISS — Fetched from MongoDB`;
          banner.classList.add("miss");
        }

        detail.innerHTML = `
          <img
            src="${p.imageUrl}"
            alt="${p.name}"
            onerror="this.src='https://via.placeholder.com/300x300?text=No+Image'"
          />
          <div class="detail-info">
            <h2>${p.name}</h2>
            <p class="price">Rs. ${p.price.toLocaleString()}</p>
            <span class="category">${p.category}</span>
            <p class="description">${p.description}</p>
            <p class="stock">${p.inStock ? "✅ In Stock" : "❌ Out of Stock"}</p>
          </div>
        `;
      })
      .catch(() => {
        detail.innerHTML = "<p>Error loading product.</p>";
      });
  }
}

function goToProduct(id) {
  window.location.href = `/product.html?id=${id}`;
}

function openModal() {
  document.getElementById('addModal').classList.add('open');
}

function closeModal() {
  document.getElementById('addModal').classList.remove('open');
}

window.addEventListener("click", (e) => {
  const modal = document.getElementById("addModal");
  if (e.target === modal) closeModal();
});
