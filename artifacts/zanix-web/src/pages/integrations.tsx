import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function IntegrationsPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-900 text-white">
      <div className="w-full max-w-2xl bg-gray-800 rounded-lg shadow-lg p-8">
        <Link href="/chat">
          <button className="flex items-center gap-2 text-gray-400 hover:text-gray-200 transition-colors mb-6">
            <ArrowLeft className="w-5 h-5" />
            Back to Chat
          </button>
        </Link>
        <h1 className="text-3xl font-bold mb-6 text-center">External Integrations</h1>
        <p className="text-gray-300 text-center mb-8">Connect Zanix AI with your favorite tools to supercharge your workflow.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* GitHub Integration */}
          <div className="bg-gray-700 p-6 rounded-lg flex flex-col items-center text-center">
            <img src="https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png" alt="GitHub" className="w-16 h-16 mb-4" />
            <h2 className="text-xl font-semibold mb-2">GitHub</h2>
            <p className="text-gray-400 mb-4">Manage repositories, commit code, and automate development tasks.</p>
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full transition-colors">Connect GitHub</button>
          </div>

          {/* Google Drive Integration */}
          <div className="bg-gray-700 p-6 rounded-lg flex flex-col items-center text-center">
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Google_Drive_icon_%282020%29.svg/1200px-Google_Drive_icon_%282020%29.svg.png" alt="Google Drive" className="w-16 h-16 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Google Drive</h2>
            <p className="text-gray-400 mb-4">Access, create, and manage your documents and spreadsheets.</p>
            <button className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-full transition-colors">Connect Google Drive</button>
          </div>

          {/* Slack Integration */}
          <div className="bg-gray-700 p-6 rounded-lg flex flex-col items-center text-center">
            <img src="https://upload.wikimedia.org/wikipedia/commons/d/d5/Slack_icon_2019.svg" alt="Slack" className="w-16 h-16 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Slack</h2>
            <p className="text-gray-400 mb-4">Send messages, notifications, and collaborate with your team.</p>
            <button className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-full transition-colors">Connect Slack</button>
          </div>

          {/* Notion Integration */}
          <div className="bg-gray-700 p-6 rounded-lg flex flex-col items-center text-center">
            <img src="https://upload.wikimedia.org/wikipedia/commons/e/e9/Notion-logo.svg" alt="Notion" className="w-16 h-16 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Notion</h2>
            <p className="text-gray-400 mb-4">Organize your notes, tasks, and projects with powerful AI assistance.</p>
            <button className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-full transition-colors">Connect Notion</button>
          </div>
        </div>
      </div>
    </div>
  );
}
