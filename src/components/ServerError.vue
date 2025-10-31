<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="text-center px-4">
      <h1 class="text-6xl font-bold text-gray-900 mb-4">500</h1>
      <h2 class="text-2xl font-semibold text-gray-700 mb-4">
        Internal Server Error
      </h2>
      <p class="text-gray-600 mb-8 max-w-md mx-auto">
        Sorry, something went wrong on our end. We're working to fix the issue.
      </p>
      <router-link
        to="/dashboard"
        class="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
      >
        Back to Home
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>

</style>