import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '@/pages/HomePage.vue'
import LobbyPage from '@/pages/LobbyPage.vue'
import GamePage from '@/pages/GamePage.vue'
import ResultsPage from '@/pages/ResultsPage.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/',        name: 'home',    component: HomePage },
    { path: '/lobby',   name: 'lobby',   component: LobbyPage },
    { path: '/game',    name: 'game',    component: GamePage },
    { path: '/results', name: 'results', component: ResultsPage },
  ],
})

export default router
