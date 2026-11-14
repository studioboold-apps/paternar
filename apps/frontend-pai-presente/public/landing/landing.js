// Entrada das secoes ao rolar a vitrine. Sem este arquivo (ou sem JS), tudo
// aparece parado: o CSS so esconde `.revelar` quando o `<html>` tem `.js`.
(function () {
  var raiz = document.documentElement;
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var alvos = document.querySelectorAll(
    'main .bloco .rotulo, main .bloco .titulo-secao, main .bloco .texto-secao, .agente, .cartao, .passos li, .muda-lista li, .pilares li, .fundadora, .preco, .duvidas details, .frase p, .final .botoes, .rodape-grade > *'
  );
  var grupos = new Map();
  alvos.forEach(function (el) {
    var pai = el.parentElement;
    var i = grupos.get(pai) || 0;
    grupos.set(pai, i + 1);
    el.classList.add('revelar');
    el.style.setProperty('--atraso', Math.min(i, 5) * 0.09 + 's');
  });
  raiz.classList.add('js');

  var observador = new IntersectionObserver(
    function (entradas) {
      entradas.forEach(function (entrada) {
        if (!entrada.isIntersecting) return;
        entrada.target.classList.add('visivel');
        observador.unobserve(entrada.target);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
  );
  alvos.forEach(function (el) { observador.observe(el); });
})();
