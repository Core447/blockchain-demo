"use client"

import { useState } from "react"
import { HelpCircle, ChevronRight, ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"

const guideSteps = [
  {
    title: "Welcome to Blockchain Demo",
    content: (
      <div className="space-y-3">
        <p>This interactive blockchain demonstration allows you to understand how blockchain technology works by simulating a peer-to-peer network. You can reopen this guide at any time by clicking the help icon in the bottom right corner.</p>
        <p className="font-semibold">Key Concepts:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Peer-to-Peer Network:</strong> Connect with other users to form a decentralized network</li>
          <li><strong>Transactions:</strong> Send currency to other peers in the network</li>
          <li><strong>Mining:</strong> Process transactions and add them to the blockchain</li>
          <li><strong>Blockchain:</strong> A chain of verified blocks containing transaction history</li>
        </ul>
        <p className="text-sm text-muted-foreground mt-3">You can always learn more about the different buttons and sections on the website by clicking the info icon (i) next to the button or section.</p>
      </div>
    ),
  },
  {
    title: "Your Dashboard",
    content: (
      <div className="space-y-3">
        <p>At the top of the page, you&apos;ll see key information about you:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Peer ID:</strong> Your unique identifier in the network</li>
          <li><strong>Public Keys:</strong> Number of other peers&apos; public keys you have (needed for verifying transactions)</li>
          <li><strong>Balance:</strong> Your current currency balance in the blockchain</li>
        </ul>
        <p className="text-sm text-muted-foreground mt-3">Note: Your balance updates automatically as you mine blocks and send/receive transactions.</p>
      </div>
    ),
  },
  {
    title: "Getting Started",
    content: (
      <div className="space-y-3">
        <p className="font-semibold">To start using the blockchain demo, follow these steps:</p>
        <ol className="list-decimal pl-5 space-y-2">
          <li><strong>Connect to peers:</strong> Open this website in a second tab or on a second device, so that you have at least two peers/users in the network. You don&apos;t need to be on the same network for this to work.</li>
          <li><strong>Send transactions:</strong> Use the &quot;Send Currency To Everyone&quot; button or send to specific peers by clicking on them.</li>
          <li><strong>Mine blocks:</strong> Click &quot;Mine Latest Transaction&quot; to mine one of the pending transactions and add them to the blockchain</li>
        </ol>
      </div>
    ),
  },
  {
    title: "Active Connections",
    content: (
      <div className="space-y-3">
        <p>This section shows all peers you&apos;re currently connected to.</p>
        <p className="font-semibold">What you can do:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>View balances:</strong> See each peer&apos;s current balance</li>
          <li><strong>Send currency:</strong> Click on a connection to send them specific amounts</li>
          <li><strong>Steal currency:</strong> (Attack action) Send currency from another peer to your own balance by creating a fake transaction</li>
        </ul>
      </div>
    ),
  },
  {
    title: "Pending Transactions",
    content: (
      <div className="space-y-3">
        <p>This section displays transactions waiting to be mined and added to the blockchain.</p>
        <p className="font-semibold">Understanding transactions:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Sender & Receiver:</strong> Who is sending currency to whom</li>
          <li><strong>Amount:</strong> How much currency is being transferred</li>
          <li><strong>Valid/Invalid:</strong> Whether the transaction&apos;s signature is verified</li>
        </ul>
        <p className="text-sm text-muted-foreground mt-3">Transactions remain pending until someone mines them into a block.</p>
      </div>
    ),
  },
  {
    title: "Mined Blocks",
    content: (
      <div className="space-y-3">
        <p>This section shows all the blocks of the blockchain.</p>
        <p className="font-semibold">Block components:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Block Hash:</strong> The hash of the block</li>
          <li><strong>Previous Hash:</strong> Links to the previous block, forming a chain</li>
          <li><strong>Proof of Work:</strong> The computational solution that validates the block</li>
          <li><strong>Transactions:</strong> All transactions included in this block</li>
          <li><strong>Miner Reward:</strong> Currency awarded to whoever mined the block</li>
        </ul>
        <p className="text-sm text-muted-foreground mt-3">Click on a block to expand and see all its details.</p>
      </div>
    ),
  },
  {
    title: "Normal Actions",
    content: (
      <div className="space-y-3">
        <p className="font-semibold">These are the standard actions that you can perform:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Send Currency To Everyone:</strong> Creates transactions sending a random amount of currency (between 0 and 1000) to each connected peer. This is a quick way to generate network activity.</li>
          <li><strong>Mine Latest Transaction:</strong> Processes pending transactions by solving the proof-of-work puzzle and creating a new block. You&apos;ll earn block rewards for mining!</li>
        </ul>
        <p className="text-sm text-muted-foreground mt-3">Each action button has an info icon (i) for more details.</p>
      </div>
    ),
  },
  {
    title: "Attack Actions",
    content: (
      <div className="space-y-3">
        <p>These actions allow you to test how the network reacts to attacks:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Add Coherent Block To Local Chain:</strong> Adds a valid block structure to your local chain. Can be used to test how the network resolves conflicting chains.</li>
          <li><strong>Clear Own Chain:</strong> Deletes your entire local blockchain.</li>
          <li><strong>Block Rewards:</strong> Adjust how many block reward units you claim when mining (normally 1, but you can try claiming more to see what happens).</li>
        </ul>
        <p className="text-sm text-muted-foreground mt-3">Each action button has an info icon (i) for more details.</p>
      </div>
    ),
  },
]

export function HelpGuide() {
  const [open, setOpen] = useState(true)
  const [currentStep, setCurrentStep] = useState(0)

  const handleNext = () => {
    if (currentStep < guideSteps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleClose = () => {
    setOpen(false)
    setCurrentStep(0)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="default"
          size="icon"
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg p-0"
        >
          <HelpCircle className="h-6 w-6" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {guideSteps[currentStep].title}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="pt-4">
              {guideSteps[currentStep].content}
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
          <div className="flex items-center justify-between w-full gap-2">
            <div className="text-sm text-muted-foreground">
              Step {currentStep + 1} of {guideSteps.length}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              {currentStep === guideSteps.length - 1 ? (
                <Button onClick={handleClose}>
                  Finish
                </Button>
              ) : (
                <Button onClick={handleNext}>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


