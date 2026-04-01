<!-- src/components/NotFound.vue -->
<template>
  <div class="not-found">
    <h1>404</h1>
    <p>Page not found</p>
    <router-link to="/dashboard">Go Home</router-link>
  </div>
</template>

<style scoped>
.not-found {
  text-align: center;
  margin-top: 80px;
}
h1 {
  font-size: 5rem;
  color: #ef4444;
}
p {
  font-size: 1.5rem;
  margin-bottom: 24px;
  color: grey;
}
</style>