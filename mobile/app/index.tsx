import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

const actions = [
  'Nova venda',
  'Vendas de hoje',
  'A receber',
  'Produtores',
  'Clientes',
  'Cotacoes',
  'Relatorios',
];

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.brand}>AgroVenda Broker</Text>
        <Text style={styles.title}>Operacao do dia</Text>
      </View>
      <View style={styles.grid}>
        {actions.map((action) => (
          <Pressable key={action} style={styles.button}>
            <Text style={styles.buttonText}>{action}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f6f7f2',
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  brand: {
    color: '#526052',
    fontSize: 15,
    marginBottom: 8,
  },
  title: {
    color: '#172016',
    fontSize: 32,
    fontWeight: '700',
  },
  grid: {
    gap: 12,
  },
  button: {
    minHeight: 76,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d7ddcf',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#172016',
    fontSize: 18,
    fontWeight: '700',
  },
});
