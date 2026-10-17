# Runestone

Runestone is a high-fidelity, local-first cinephile tracking application designed to catalogue and monitor personal viewings of Movies, TV Shows, Anime, and Documentaries. Unlike public platform alternatives, Runestone integrates all media platforms into a single, unified local environment with custom annotations, tracking priority queues, and granular episode-level watch counters.

---

## Project Details

### Vision and Framework
The application is built on Expo (React Native) utilizing NativeWind v4 (Tailwind CSS engine) for custom layouts and standard React Native Animated APIs to achieve 120 FPS UI-thread animations.

### Feature Specification
* **TMDb Query Integration:** Unified search endpoint fetching posters, backdrops, cast directories, runtimes, and season/episode metadata.
* **Granular Watch Statuses:** Support for six core states:
  * Watching
  * Completed
  * On Hold (requires text annotations explaining the hold rationale)
  * Dropped (custom rating out of 10.0 and reasons for dropping)
  * Plan to Watch
  * Rewatching
* **Episode Progress Tracker:** Interactive season and episode watch counters with dashboard quick-increment tools.
* **Smart Watchlist:** Media queue equipped with custom priority levels (High, Medium, Low), added timestamps, and "Why Added" descriptors.
* **Cinephile Analytics:** Detailed statistics screen calculating global watch-time metrics, genre density, director completed lists, and media format distributions.

---

## Installation

### Prerequisites
* Node.js (v18 or higher recommended)
* npm (v9 or higher) or Yarn
* Expo Go app installed on your testing device (iOS/Android) or active emulators

### Step-by-Step Setup
1. **Install Dependencies:**
   Install required node modules and peer dependencies.
   ```bash
   npm install
   ```

2. **Configure Environment Variables:**
   Create a `.env` file in the root directory to store your TMDb API credentials securely.
   ```env
   EXPO_PUBLIC_TMDB_API_KEY=your_tmdb_read_access_token_here
   ```

3. **Start the Development Server:**
   Launch the Metro Bundler. To access your local dev build on a physical device over standard cellular networks, execute the tunnel flag command.
   ```bash
   npx expo start --tunnel
   ```

4. **Connect a Device:**
   Scan the generated QR code in your terminal with your device's camera (iOS) or via the Expo Go application (Android).

---

## Troubleshooting

### NativeWind CSS Compilation Failures
* **Symptom:** Utility classes (`className`) applied in components do not alter elements, or styling changes fail to render on-screen.
* **Resolution:** 
  1. Verify `metro.config.js` is wrapping your configuration with `withNativeWind`.
  2. Confirm your `tailwind.config.js` contains the correct scan directory under the `content` block (e.g. `./src/**/*.{js,jsx,ts,tsx}`).
  3. Clear your cache and restart Metro with the following clean command:
     ```bash
     npx expo start -c
     ```

### New Architecture Warnings on Android
* **Symptom:** Terminal output displays warnings regarding layout configurations: `setLayoutAnimationEnabledExperimental is currently a no-op in the New Architecture`.
* **Resolution:** Under modern React Native engines (Fabric), native spring animations are integrated. Remove legacy statements invoking `UIManager.setLayoutAnimationEnabledExperimental` in your entry scripts.

### TMDb API Access Blocked / Connection Timeout
* **Symptom:** Search results fail to load or report network request timeout errors.
* **Resolution:** 
  1. Ensure your `.env` variable key begins with `EXPO_PUBLIC_` so it is compiled correctly by the Expo CLI.
  2. If using real mobile devices, confirm both the server and device are connected to active internet access.
  3. Ensure you are running the server with the `--tunnel` flag if the device and computer are on separate Wi-Fi configurations or cellular systems.

### Package Peer Dependency Conflicts (Legacy Packages)
* **Symptom:** Running `npm install` reports dependency tree conflicts (e.g., matching React Native Reanimated versions or Moti worklets).
* **Resolution:** Install packages using the peer-dependency bypass flag:
   ```bash
   npm install <package-name> --legacy-peer-deps
   ```
   Or utilize standard, built-in React Native `Animated` structures to reduce external bundle overhead and prevent node engine runtime errors.
