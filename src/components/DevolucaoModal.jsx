import { useState } from 'react';
import api from '../services/api';
import Swal from 'sweetalert2';

// Devolução do próprio carrinho pelo funcionário, produto a produto
// (o backend exige a quantidade devolvida de cada produto do carrinho).
export function DevolucaoModal({ carrinho, onClose, onSuccess }) {
  const [itens, setItens] = useState(
    (carrinho?.itens || []).map(item => ({
      produtoId: item.produtoId,
      produtoNome: item.produtoNome,
      quantidadeEsperada: item.quantidadeEsperada ?? 0,
      quantidadeDevolvida: String(item.quantidadeEsperada ?? 0) // pré-preenchido com o esperado
    }))
  );
  const [observacao, setObservacao] = useState('');
  const [loading, setLoading] = useState(false);

  const totalEsperado = itens.reduce((soma, item) => soma + item.quantidadeEsperada, 0);
  const totalDevolvido = itens.reduce((soma, item) => soma + (parseInt(item.quantidadeDevolvida, 10) || 0), 0);
  const itensFaltando = itens.filter(
    item => item.quantidadeDevolvida !== '' && parseInt(item.quantidadeDevolvida, 10) < item.quantidadeEsperada
  );

  function alterarQuantidade(index, valor) {
    setItens(prev => prev.map((item, i) => (i === index ? { ...item, quantidadeDevolvida: valor } : item)));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (itens.length === 0) {
      Swal.fire({
        icon: 'error',
        title: 'Carrinho sem produtos',
        text: 'Não foi possível carregar os produtos do carrinho. Atualize a página e tente de novo.'
      });
      return;
    }

    if (itens.some(item => item.quantidadeDevolvida === '' || parseInt(item.quantidadeDevolvida, 10) < 0)) {
      Swal.fire({
        icon: 'error',
        title: 'Quantidade inválida',
        text: 'Informe a quantidade devolvida (zero ou mais) de todos os produtos'
      });
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/carrinho-usuarios/devolucao', {
        carrinhoId: carrinho.id,
        itens: itens.map(item => ({
          produtoId: item.produtoId,
          quantidadeDevolvida: parseInt(item.quantidadeDevolvida, 10)
        })),
        observacao: observacao || undefined
      });

      const data = response.data;

      if (data.ok) {
        if (data.alertaGerado) {
          const faltas = (data.devolucao?.itens || []).filter(item => item.discrepancia < 0);
          await Swal.fire({
            icon: 'warning',
            title: 'Devolução registrada com discrepância',
            html: `
              <div class="text-left">
                <p class="mb-2"><strong>Quantidade devolvida:</strong> ${data.devolucao.quantidadeDevolvida}</p>
                <p class="mb-2"><strong>Quantidade esperada:</strong> ${data.devolucao.quantidadeEsperada}</p>
                ${faltas
                  .map(item => `<p class="text-sm">${item.produto?.nome || 'Produto'}: faltaram ${Math.abs(item.discrepancia)} unidades</p>`)
                  .join('')}
              </div>
              <div class="mt-4 p-3 bg-yellow-100 rounded">
                <p class="text-sm">⚠️ Um alerta foi gerado para o administrador verificar.</p>
              </div>
            `,
            confirmButtonText: 'Entendi'
          });
        } else {
          await Swal.fire({
            icon: 'success',
            title: 'Devolução registrada!',
            text: 'As quantidades conferem.',
            timer: 3000,
            showConfirmButton: false
          });
        }

        if (onSuccess) {
          onSuccess();
        }
        onClose();
      }
    } catch (error) {
      console.error('Erro ao registrar devolução:', error);
      Swal.fire({
        icon: 'error',
        title: 'Erro ao registrar devolução',
        text: error.response?.data?.erro || error.message || 'Erro desconhecido'
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-2xl font-bold text-gray-800">Registrar Devolução</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              disabled={loading}
            >
              ×
            </button>
          </div>

          {/* Info do carrinho */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">📦</span>
              <span className="font-semibold text-gray-800">Quantidade esperada no carrinho:</span>
            </div>
            <p className="text-3xl font-bold text-blue-600 text-center">
              {totalEsperado} unidades
            </p>
          </div>

          {/* Exibir observação do carrinho se existir */}
          {carrinho?.observacao && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
              <p className="text-sm font-semibold text-gray-700 mb-1">📝 Observação do carrinho:</p>
              <p className="text-sm text-gray-600">{carrinho.observacao}</p>
            </div>
          )}

          {/* Formulário */}
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-gray-700 font-semibold mb-2">
                Quanto você está devolvendo de cada produto? *
              </label>
              <div className="space-y-2">
                {itens.map((item, index) => {
                  const devolvido = parseInt(item.quantidadeDevolvida, 10);
                  const faltando = item.quantidadeDevolvida !== '' && devolvido < item.quantidadeEsperada;
                  return (
                    <div
                      key={item.produtoId}
                      className={`flex items-center gap-3 p-2 rounded-lg ${faltando ? 'bg-red-50' : 'bg-gray-50'}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{item.produtoNome}</p>
                        <p className="text-xs text-gray-500">Deve devolver: {item.quantidadeEsperada}</p>
                      </div>
                      <input
                        type="number"
                        value={item.quantidadeDevolvida}
                        onChange={(e) => alterarQuantidade(index, e.target.value)}
                        min="0"
                        required
                        className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-semibold text-center"
                        disabled={loading}
                      />
                    </div>
                  );
                })}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Digite a quantidade física que você está devolvendo de cada produto
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-gray-700 font-semibold mb-2">
                Observação sobre a devolução (opcional)
              </label>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows="3"
                placeholder="Ex: Máquina X com defeito, Loja Y fechada, Cliente cancelou pedido..."
                maxLength={500}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-vertical"
                disabled={loading}
              />
              <small className="text-gray-500">{observacao.length}/500 caracteres</small>
              <p className="text-xs text-gray-500 mt-1">
                💡 Use este campo para explicar discrepâncias ou situações especiais
              </p>
            </div>

            {/* Alerta de falta */}
            {itensFaltando.length > 0 && (
              <div className="mb-6 p-4 rounded-lg border bg-red-50 border-red-200">
                <div className="flex items-center gap-2">
                  <span className="text-xl">⚠️</span>
                  <div>
                    <p className="font-semibold">Atenção: quantidade menor que o esperado</p>
                    <p className="text-sm">
                      {itensFaltando.length} produto(s) a menos · total {totalDevolvido} de {totalEsperado}
                    </p>
                    <p className="text-xs mt-1">
                      Um alerta será gerado para o administrador verificar.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Botões */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 py-3 px-4 bg-green-500 text-white font-semibold rounded-lg transition-colors shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? 'Enviando...' : 'Confirmar Devolução'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
