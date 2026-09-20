/**
 * LD Chatzz
 * Copyright Lisa's Dungeon. All Rights Reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL
 *
 * This file is part of LD Chatzz.
 * Unauthorized copying, distribution, modification, or use of this file
 * is strictly prohibited and constitutes copyright infringement.
 *
 * All intellectual property rights are owned exclusively by Lisa's Dungeon.
 *
 * @copyright Lisa's Dungeon
 * @license   Proprietary - All Rights Reserved
 */

import { registerHooks } from "./src/hooks.js";

registerHooks(globalThis);

export { registerHooks };

export async function getLDChatzz() {
    const { LDChatzz } = await import("./src/LDChatzz.js");
    return LDChatzz;
}
