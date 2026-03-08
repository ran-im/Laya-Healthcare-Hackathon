import { Heart } from 'lucide-react'

export function Footer() {
  return (
    <footer className="bg-laya-dark text-white py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            <Heart className="h-6 w-6 text-laya-accent" />
            <span className="font-bold text-lg">Laya Healthcare</span>
          </div>
          <div className="text-sm text-gray-300">
            &copy; {new Date().getFullYear()} Laya Healthcare Hackathon. All rights reserved.
          </div>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <a href="#" className="text-gray-300 hover:text-laya-accent transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="text-gray-300 hover:text-laya-accent transition-colors">
              Terms of Service
            </a>
            <a href="#" className="text-gray-300 hover:text-laya-accent transition-colors">
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
