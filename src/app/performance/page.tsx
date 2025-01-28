"use client"
import React, { useState, useEffect } from 'react';
import { createHash } from 'crypto';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const TestPage = () => {
    const [results, setResults] = useState({});
    const [isRunning, setIsRunning] = useState(false);
    const [currentTest, setCurrentTest] = useState('');

    // Function to calculate hash of a packet
    const calculateHashOfPacket = (packet) => {
        const packetString = JSON.stringify(packet);
        const hash = createHash('sha1');
        hash.update(packetString);
        return hash.digest('hex');
    };

    // Function to normalize hash to float
    const getHashAsNormalizedFloat = (hash) => {
        const hashInt = BigInt(`0x${hash}`);
        const maxHash = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF");
        return Number(hashInt) / Number(maxHash);
    };

    // Function to check if hash is valid for given difficulty
    const isHashValid = (hash, difficulty) => {
        const threshold = 0.0002 - (0.0002 - 0.00002) * difficulty;
        return getHashAsNormalizedFloat(hash) < threshold;
    };

    // Function to find proof of work
    const findProofOfWork = (difficulty) => {
        const packet = {
            type: "test",
            data: { test: "data" },
            sender: "tester",
            receivers: ["test"],
            proofOfWork: 0
        };

        const start = performance.now();
        let hash = calculateHashOfPacket(packet);
        
        while (!isHashValid(hash, difficulty)) {
            packet.proofOfWork += 1;
            hash = calculateHashOfPacket(packet);
        }
        
        const duration = performance.now() - start;
        return duration;
    };

    // Function to get median value
    const getMedian = (values) => {
        if (values.length === 0) return 0;
        
        const sorted = [...values].sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);
        
        if (sorted.length % 2 === 0) {
            return (sorted[middle - 1] + sorted[middle]) / 2;
        }
        
        return sorted[middle];
    };

    // Function to run all tests
    const runTests = async () => {
        setIsRunning(true);
        const difficulties = [0, 0.25, 0.5, 0.75, 1];
        const newResults = {};

        for (const difficulty of difficulties) {
            setCurrentTest(`Running tests for difficulty ${difficulty}`);
            const durations = [];
            
            for (let i = 0; i < 10; i++) {
                durations.push(findProofOfWork(difficulty));
                // Small delay to prevent UI freeze
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            newResults[difficulty] = {
                median: getMedian(durations),
                all: durations
            };
        }

        setResults(newResults);
        setIsRunning(false);
        setCurrentTest('');
    };

    // Create a sorted array of difficulties for display
    const sortedDifficulties = Object.keys(results)
        .map(Number)
        .sort((a, b) => a - b);

    return (
        <div className="p-4 max-w-4xl mx-auto">
            <Card>
                <CardHeader>
                    <CardTitle>Hash Performance Test</CardTitle>
                </CardHeader>
                <CardContent>
                    <Button 
                        onClick={runTests} 
                        disabled={isRunning}
                        className="mb-4"
                    >
                        {isRunning ? 'Running Tests...' : 'Run Performance Tests'}
                    </Button>

                    {currentTest && (
                        <p className="text-sm text-gray-500 mb-4">{currentTest}</p>
                    )}

                    {Object.keys(results).length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr>
                                        <th className="border p-2 bg-gray-100">Difficulty</th>
                                        <th className="border p-2 bg-gray-100">Median Duration (ms)</th>
                                        <th className="border p-2 bg-gray-100">Individual Results (ms)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedDifficulties.map(difficulty => (
                                        <tr key={difficulty}>
                                            <td className="border p-2">{difficulty}</td>
                                            <td className="border p-2">{results[difficulty].median.toFixed(2)}</td>
                                            <td className="border p-2 text-xs">
                                                {results[difficulty].all.map(d => d.toFixed(2)).join(', ')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default TestPage;