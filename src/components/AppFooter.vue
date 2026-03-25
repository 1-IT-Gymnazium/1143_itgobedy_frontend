<template>
  <footer class="app-footer">
    <div class="footer-container">
      <div class="footer-content">
        <div class="footer-info">
          <p class="footer-copyright">© {{ currentYear }} Svášek & Orgován. In cooperation with ITG.</p>
          <p class="footer-subtitle">Making lunch management simple and delicious</p>
        </div>
        <div class="footer-decoration">
          <div class="footer-logo">
            <img src="https://static.wixstatic.com/media/b66571_d6f3daf98b47425482c8b9ac7c3c0c9b~mv2.png" alt="ITG" class="footer-logo-img" />
          </div>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { computed } from 'vue';

const currentYear = computed(() => new Date().getFullYear());
</script>

<style scoped>
.app-footer {
  background: rgba(255, 255, 255, 0.85); /* semi-transparent for light theme */
  border-top: 1px solid var(--border-primary);
  margin-top: auto;
  backdrop-filter: blur(20px);
  position: relative;
  overflow: hidden;
  width: 100vw;
  left: 50%;
  transform: translateX(-50%);
}

[data-theme='dark'] .app-footer {
  background: rgba(32, 32, 32, 0.85); /* semi-transparent for dark theme */
}

.app-footer::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--brand-primary), transparent);
  opacity: 0.3;
}

.footer-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 var(--space-lg);
  width: 100%;
}

.footer-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md) 0;
  min-height: 52px;
  flex-wrap: wrap;
}

.footer-info {
  flex: 1;
}

.footer-copyright {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
  margin-bottom: var(--space-xs);
  letter-spacing: -0.01em;
}

.footer-subtitle {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin: 0;
  font-style: italic;
}

.footer-decoration {
  display: flex;
  align-items: center;
  opacity: 0.6;
}

.footer-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.footer-logo-img {
  height: 40px;
  width: auto;
  max-width: 30vw;
  transition: all var(--transition-normal);
}

.footer-logo:hover .footer-logo-img {
  transform: scale(1.1);
}

/* Responsive */
@media (max-width: 768px) {
  .footer-container {
    padding: 0 var(--space-md);
  }

  .footer-content {
    flex-direction: column;
    text-align: center;
    gap: var(--space-md);
    padding: var(--space-xl) 0;
  }

  .footer-copyright {
    font-size: var(--font-size-sm);
  }

  .footer-subtitle {
    font-size: var(--font-size-xs);
  }

  .footer-logo-img {
    height: 64px;
    max-width: 60vw;
  }
}

@media (max-width: 480px) {
  .footer-logo-img {
    height: 48px;
    max-width: 80vw;
  }
}
</style>
