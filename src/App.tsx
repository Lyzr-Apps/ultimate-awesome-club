import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { FiHome, FiTrendingUp, FiBarChart2, FiPlus, FiFilter, FiEdit3, FiTrash2, FiX } from 'react-icons/fi';
import parseLLMJson from './utils/jsonParser';

interface Transaction {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  type: 'income' | 'expense';
}

interface InsightsData {
  insights_report: {
    summary: {
      total_income: number;
      total_expenses: number;
      balance: number;
      savings_rate: number;
      top_spending_categories: Array<{ category: string; amount: number; percentage: number }>;
      monthly_trend: Array<{ month: string; income: number; expenses: number }>;
    };
    insights: string[];
    recommendations: string[];
    confidence_score: number;
  };
  metadata: {
    analysis_timestamp: string;
    data_period: string;
    transaction_count: number;
  };
}

interface CategorizationData {
  categorization: {
    primary_category: string;
    confidence_score: number;
    alternative_categories: string[];
    reasoning: string;
  };
  metadata: {
    processing_time: string;
    patterns_matched: string[];
    version: string;
  };
}

const CATEGORIES = [
  'Food & Dining', 'Transportation', 'Shopping', 'Entertainment', 'Bills & Utilities',
  'Healthcare', 'Education', 'Personal Care', 'Home & Garden', 'Travel', 'Gifts & Donations',
  'Investment', 'Salary', 'Freelance', 'Other'
];

const COLORS = ['#3F51B5', '#FFC107', '#4CAF50', '#FF9800', '#F44336', '#2196F3', '#9C27B0', '#00BCD4'];

function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentView, setCurrentView] = useState<'dashboard' | 'transactions' | 'insights'>('dashboard');
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [categorization, setCategorization] = useState<CategorizationData | null>(null);
  const [filters, setFilters] = useState({
    category: '',
    type: '',
    dateRange: '30'
  });

  const [formData, setFormData] = useState({
    amount: '',
    category: '',
    description: '',
    type: 'expense' as 'income' | 'expense',
    date: new Date().toISOString().split('T')[0]
  });

  const generateRandomId = () => Math.random().toString(36).substr(2, 9);

  const callAgent = async (agentId: string, message: string) => {
    try {
      const response = await fetch('https://agent-prod.studio.lyzr.ai/v3/inference/chat/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'sk-default-obhGvAo6gG9YT9tu6ChjyXLqnw7TxSGY'
        },
        body: JSON.stringify({
          user_id: `user_${generateRandomId()}@test.com`,
          agent_id: agentId,
          session_id: `session_${generateRandomId()}`,
          message: message
        })
      });

      if (!response.ok) throw new Error('Agent request failed');

      const data = await response.json();
      return parseLLMJson(data.message || '{}');
    } catch (error) {
      console.error('Agent call failed:', error);
      return null;
    }
  };

  const suggestCategory = async (description: string) => {
    const transaction = {
      description,
      amount: parseFloat(formData.amount) || 0,
      type: formData.type
    };

    const response = await callAgent('68e17dbb010a31eba9890b72', JSON.stringify(transaction));
    if (response?.categorization) {
      setCategorization(response);
      setFormData(prev => ({ ...prev, category: response.categorization.primary_category }));
    }
  };

  const generateInsights = async () => {
    const response = await callAgent('68e17dae3637bc8ddc9fff92', JSON.stringify(transactions));
    if (response?.insights_report) {
      setInsights(response);
    }
  };

  useEffect(() => {
    if (transactions.length > 0) {
      generateInsights();
    }
  }, [transactions]);

  const addTransaction = () => {
    const transaction: Transaction = {
      id: generateRandomId(),
      amount: parseFloat(formData.amount),
      category: formData.category,
      description: formData.description,
      date: formData.date,
      type: formData.type
    };
    setTransactions([...transactions, transaction]);
    resetForm();
  };

  const updateTransaction = () => {
    if (editingTransaction) {
      setTransactions(transactions.map(t =>
        t.id === editingTransaction.id
          ? {
              ...t,
              amount: parseFloat(formData.amount),
              category: formData.category,
              description: formData.description,
              date: formData.date,
              type: formData.type
            }
          : t
      ));
      setEditingTransaction(null);
      resetForm();
    }
  };

  const deleteTransaction = (id: string) => {
    setTransactions(transactions.filter(t => t.id !== id));
  };

  const resetForm = () => {
    setFormData({
      amount: '',
      category: '',
      description: '',
      type: 'expense',
      date: new Date().toISOString().split('T')[0]
    });
    setShowTransactionForm(false);
    setEditingTransaction(null);
    setCategorization(null);
  };

  const openEditForm = (transaction: Transaction) => {
    setFormData({
      amount: transaction.amount.toString(),
      category: transaction.category,
      description: transaction.description,
      type: transaction.type,
      date: transaction.date
    });
    setEditingTransaction(transaction);
    setShowTransactionForm(true);
  };

  const getFilteredTransactions = () => {
    let filtered = [...transactions];

    if (filters.category) {
      filtered = filtered.filter(t => t.category === filters.category);
    }

    if (filters.type) {
      filtered = filtered.filter(t => t.type === filters.type);
    }

    if (filters.dateRange !== 'all') {
      const days = parseInt(filters.dateRange);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      filtered = filtered.filter(t => new Date(t.date) >= cutoffDate);
    }

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const getSummaryData = () => {
    const filtered = getFilteredTransactions();
    const income = filtered.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expenses = filtered.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    return {
      income,
      expenses,
      balance: income - expenses
    };
  };

  const getChartData = () => {
    const categoryData = CATEGORIES.map(category => {
      const amount = transactions
        .filter(t => t.category === category && t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
      return { name: category, value: amount };
    }).filter(item => item.value > 0);

    return categoryData;
  };

  const getMonthlyData = () => {
    const monthlyMap = new Map<string, { income: number; expenses: number }>();

    transactions.forEach(transaction => {
      const month = new Date(transaction.date).toLocaleString('default', { month: 'short' });
      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, { income: 0, expenses: 0 });
      }
      const current = monthlyMap.get(month)!;
      if (transaction.type === 'income') {
        current.income += transaction.amount;
      } else {
        current.expenses += transaction.amount;
      }
    });

    return Array.from(monthlyMap.entries()).map(([month, data]) => ({
      month,
      income: data.income,
      expenses: data.expenses
    }));
  };

  const summary = getSummaryData();
  const filteredTransactions = getFilteredTransactions();

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-xl font-semibold text-[#3F51B5]">Budget Tracker</h1>
              <div className="flex space-x-4">
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                    currentView === 'dashboard'
                      ? 'bg-[#3F51B5] text-white'
                      : 'text-gray-700 hover:text-[#3F51B5] hover:bg-gray-50'
                  }`}
                >
                  <FiHome className="mr-2" />
                  Dashboard
                </button>
                <button
                  onClick={() => setCurrentView('transactions')}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                    currentView === 'transactions'
                      ? 'bg-[#3F51B5] text-white'
                      : 'text-gray-700 hover:text-[#3F51B5] hover:bg-gray-50'
                  }`}
                >
                  <FiTrendingUp className="mr-2" />
                  Transactions
                </button>
                <button
                  onClick={() => setCurrentView('insights')}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                    currentView === 'insights'
                      ? 'bg-[#3F51B5] text-white'
                      : 'text-gray-700 hover:text-[#3F51B5] hover:bg-gray-50'
                  }`}
                >
                  <FiBarChart2 className="mr-2" />
                  Insights
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowTransactionForm(true)}
              className="bg-[#3F51B5] text-white px-4 py-2 rounded-md hover:bg-[#303F9F] transition-colors flex items-center"
            >
              <FiPlus className="mr-2" />
              Add Transaction
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'dashboard' && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center">
                  <div className="p-2 bg-[#4CAF50] rounded-lg">
                    <FiTrendingUp className="text-white text-xl" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Income</p>
                    <p className="text-2xl font-bold text-gray-900">${summary.income.toFixed(2)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center">
                  <div className="p-2 bg-[#F44336] rounded-lg">
                    <FiBarChart2 className="text-white text-xl" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Expenses</p>
                    <p className="text-2xl font-bold text-gray-900">${summary.expenses.toFixed(2)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center">
                  <div className={`p-2 rounded-lg ${summary.balance >= 0 ? 'bg-[#4CAF50]' : 'bg-[#F44336]'}`}>
                    <FiBarChart2 className="text-white text-xl" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Balance</p>
                    <p className={`text-2xl font-bold ${summary.balance >= 0 ? 'text-[#4CAF50]' : 'text-[#F44336]'}`}>
                      ${summary.balance.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Expense Categories</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={getChartData()}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, value }) => `${name}: $${value.toFixed(0)}`}
                    >
                      {getChartData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`$${value}`, 'Amount']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Trend</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={getMonthlyData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`$${value}`, '']} />
                    <Legend />
                    <Bar dataKey="income" fill="#4CAF50" name="Income" />
                    <Bar dataKey="expenses" fill="#F44336" name="Expenses" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="px-6 py-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Recent Transactions</h3>
              </div>
              <div className="divide-y">
                {filteredTransactions.slice(0, 5).map(transaction => (
                  <div key={transaction.id} className="px-6 py-4 flex justify-between items-center">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{transaction.description}</p>
                      <p className="text-sm text-gray-500">{transaction.category} • {transaction.date}</p>
                    </div>
                    <p className={`text-lg font-semibold ${
                      transaction.type === 'income' ? 'text-[#4CAF50]' : 'text-[#F44336]'
                    }`}>
                      {transaction.type === 'income' ? '+' : '-'}{transaction.amount.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentView === 'transactions' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <FiFilter className="mr-2" />
                  Filters
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <select
                  value={filters.category}
                  onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3F51B5]"
                >
                  <option value="">All Categories</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                <select
                  value={filters.type}
                  onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3F51B5]"
                >
                  <option value="">All Transactions</option>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>

                <select
                  value={filters.dateRange}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3F51B5]"
                >
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                  <option value="365">Last year</option>
                  <option value="all">All time</option>
                </select>
              </div>
            </div>

            {/* Transactions List */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="px-6 py-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Transactions ({filteredTransactions.length})</h3>
              </div>
              <div className="divide-y">
                {filteredTransactions.map(transaction => (
                  <div key={transaction.id} className="px-6 py-4 flex justify-between items-center">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{transaction.description}</p>
                      <p className="text-sm text-gray-500">{transaction.category} • {transaction.date}</p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <p className={`text-lg font-semibold ${
                        transaction.type === 'income' ? 'text-[#4CAF50]' : 'text-[#F44336]'
                      }`}>
                        {transaction.type === 'income' ? '+' : '-'}{transaction.amount.toFixed(2)}
                      </p>
                      <button
                        onClick={() => openEditForm(transaction)}
                        className="text-gray-400 hover:text-[#3F51B5]"
                      >
                        <FiEdit3 />
                      </button>
                      <button
                        onClick={() => deleteTransaction(transaction.id)}
                        className="text-gray-400 hover:text-[#F44336]"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </div>
                ))}
                {filteredTransactions.length === 0 && (
                  <div className="px-6 py-12 text-center text-gray-500">
                    <p>No transactions found matching your filters.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {currentView === 'insights' && (
          <div className="space-y-6">
            {insights ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-6 rounded-lg shadow-sm border">
                    <h4 className="font-semibold text-gray-900 mb-2">Total Income</h4>
                    <p className="text-2xl font-bold text-[#4CAF50]">${insights.insights_report.summary.total_income.toFixed(2)}</p>
                  </div>
                  <div className="bg-white p-6 rounded-lg shadow-sm border">
                    <h4 className="font-semibold text-gray-900 mb-2">Total Expenses</h4>
                    <p className="text-2xl font-bold text-[#F44336]">${insights.insights_report.summary.total_expenses.toFixed(2)}</p>
                  </div>
                  <div className="bg-white p-6 rounded-lg shadow-sm border">
                    <h4 className="font-semibold text-gray-900 mb-2">Savings Rate</h4>
                    <p className="text-2xl font-bold text-[#3F51B5]">{insights.insights_report.summary.savings_rate.toFixed(1)}%</p>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Insights</h3>
                  <ul className="space-y-2">
                    {insights.insights_report.insights.map((insight, index) => (
                      <li key={index} className="text-gray-700">• {insight}</li>
                    ))}
                  </ul>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommendations</h3>
                  <ul className="space-y-2">
                    {insights.insights_report.recommendations.map((recommendation, index) => (
                      <li key={index} className="text-gray-700">• {recommendation}</li>
                    ))}
                  </ul>
                </div>
              </>
            ) : (
              <div className="bg-white p-6 rounded-lg shadow-sm border text-center text-gray-500">
                <p>Add some transactions to see insights</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Transaction Form Modal */}
      {showTransactionForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingTransaction ? 'Edit Transaction' : 'Add Transaction'}
              </h3>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                <FiX />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as 'income' | 'expense' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3F51B5]"
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3F51B5]"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3F51B5]"
                    placeholder="Transaction description"
                  />
                  <button
                    onClick={() => suggestCategory(formData.description)}
                    disabled={!formData.description}
                    className="px-3 py-2 bg-[#3F51B5] text-white rounded-md hover:bg-[#303F9F] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Suggest
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3F51B5]"
                >
                  <option value="">Select category</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                {categorization && (
                  <p className="text-sm text-gray-600 mt-1">
                    Suggested: {categorization.categorization.primary_category}
                    ({(categorization.categorization.confidence_score * 100).toFixed(0)}% confidence)
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3F51B5]"
                />
              </div>
            </div>

            <div className="flex space-x-4 mt-6">
              <button
                onClick={resetForm}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={editingTransaction ? updateTransaction : addTransaction}
                disabled={!formData.amount || !formData.category}
                className="flex-1 px-4 py-2 bg-[#3F51B5] text-white rounded-md hover:bg-[#303F9F] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingTransaction ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
