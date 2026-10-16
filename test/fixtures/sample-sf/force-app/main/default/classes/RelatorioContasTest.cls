@isTest
private class RelatorioContasTest {
    @isTest static void deveResumir() {
        System.assertEquals(0, RelatorioContas.resumo('Varejo').size());
    }
}
