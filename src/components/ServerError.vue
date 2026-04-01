<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="server-error">
      <h1>500</h1>
      <h2> Internal Server Error </h2>
      <p> Sorry, something went wrong on our end. We're working to fix the issue. </p>
      <router-link to="/"> Back to Home </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.server-error {
  text-align: center;
  margin-top: 80px;
}
h1 {
  font-size: 5rem;
  color: #ef4444;
}
h2 {
  font-size: 2rem;
  margin-bottom: 16px;
  color: var(--text-primary);
}
p {
  font-size: 1.5rem;
  margin-bottom: 24px;
  color: var(--text-secondary);
}
</style>