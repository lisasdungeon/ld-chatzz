# LD Chatzz - Data Layer

This directory contains the data management logic for LD Chatzz, following the Library-Engine-Turbo pattern.

## Structure

- **DataStore.js** (Library): Core state maps and reactive data structures.
- **DataPersistence.js** (Engine): Foundry VTT settings synchronization (load/save).
- **DataMessaging.js** (Engine): Logic for message CRUD operations.
- **DataUserUI.js** (Engine): User preferences, unread tracking, and backgrounds.
- **DataUtility.js** (Engine): Search, export, and group management.
- **DataImaging.js** (Engine): Reaction handling and image processing.
- **DataManager.js** (Turbo): The primary entry point and facade for the data layer.
