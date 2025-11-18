"use client";

import { motion } from "framer-motion";

const adapters = [
    { value: "openai", label: "OpenAI" },
    { value: "anthropic", label: "Anthropic" },
    { value: "google", label: "Google" },
];

export default function AdvancedSettings({
    adapter,
    setAdapter,
    prompt,
    setPrompt,
    cycles,
    setCycles,
}) {
    const min_cycles = 0
    const max_cycles = 3
    return (
        <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-4 p-4 bg-blue-50 rounded-lg"
        >
            <div className="space-y-4">
                <div>
                    <label
                        htmlFor="adapter"
                        className="block text-sm font-medium text-blue-800 mb-1"
                    >
                        AI Adapter
                    </label>
                    <select
                        id="adapter"
                        value={adapter}
                        onChange={(e) => setAdapter(e.target.value)}
                        className="w-full p-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 bg-white"
                    >
                        {adapters.map((item) => (
                            <option key={item.value} value={item.value}>
                                {item.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label
                        htmlFor="prompt"
                        className="block text-sm font-medium text-blue-800 mb-1"
                    >
                        Custom Prompts
                    </label>
                    <textarea
                        id="prompt"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Specific translation instructions..."
                        className="w-full p-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 bg-white h-24 resize-none"
                    />
                </div>

                <div>
                    <label
                        htmlFor="cycles"
                        className="block text-sm font-medium text-blue-800 mb-1"
                    >
                        Self-review Cycles ({`${min_cycles}-${max_cycles}`})
                    </label>
                    <input
                        id="cycles"
                        type="number"
                        min={{ min_cycles }}
                        max={{ max_cycles }}
                        value={cycles}
                        onChange={(e) => {
                            let value = e.target.value || min_cycles
                            value = Number.parseInt(value, 10)
                            value = value > max_cycles ? max_cycles : value
                            value = value < min_cycles ? min_cycles : value
                            setCycles(value)
                        }}
                        className="w-full p-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 bg-white"
                    />
                </div>
            </div>
        </motion.div>
    );
}
