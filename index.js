require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const Estagiario = require("./models/Estagiario");
const bodyParser = require("body-parser");
const fs = require("fs");
const { Parser } = require("json2csv");

const app = express();

// Habilitando o CORS e Body Parser
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("frontend"));

// Conexão ao MongoDB
mongoose
  .connect(
    `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@${process.env.MONGO_CLUSTER_URL}/${process.env.MONGO_DATABASE}?retryWrites=true&w=majority`
  )
  .then(() => console.log("✅ Conectado ao MongoDB"))
  .catch((err) => console.error("❌ Erro ao conectar ao MongoDB:", err));

// Rota para cadastrar estagiário
app.post("/api/estagiarios", async (req, res) => {
  try {
    const { nome, email } = req.body;
    if (!nome || !email) {
      return res.status(400).json({ message: "Nome e email são obrigatórios." });
    }

    const novoEstagiario = new Estagiario({ nome, email, horas: [] });
    await novoEstagiario.save();
    res.status(201).json(novoEstagiario);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao cadastrar estagiário." });
  }
});

// Rota para listar estagiários
app.get("/api/estagiarios", async (req, res) => {
  try {
    const estagiarios = await Estagiario.find();
    res.json(estagiarios);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao buscar estagiários." });
  }
});

// Rota para obter estagiário por ID (incluindo horas)
app.get("/api/estagiarios/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const estagiario = await Estagiario.findById(id);
    if (!estagiario) {
      return res.status(404).json({ message: "Estagiário não encontrado." });
    }
    res.json(estagiario);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao buscar estagiário." });
  }
});

// Rota para adicionar horas ao estagiário
app.post("/api/estagiarios/:id/horas", async (req, res) => {
  try {
    const { id } = req.params;
    const { data, horaInicio, horaFim } = req.body;

    if (!data || !horaInicio || !horaFim) {
      return res.status(400).json({
        message: "Todos os campos (data, horaInicio, horaFim) são obrigatórios.",
      });
    }

    const estagiario = await Estagiario.findById(id);
    if (!estagiario) {
      return res.status(404).json({ message: "Estagiário não encontrado." });
    }

    // Convertendo as horas e calculando o total de minutos
    const inicioDate = new Date(`${data}T${horaInicio}:00`);
    const fimDate = new Date(`${data}T${horaFim}:00`);

    if (inicioDate >= fimDate) {
      return res.status(400).json({ message: "O horário de fim deve ser maior que o de início." });
    }

    const totalMinutos = (fimDate - inicioDate) / (1000 * 60); // Conversão de milissegundos para minutos

    // Removendo a verificação do turno e limitador de horário
    // Não há mais verificação de turno para manhã/tarde

    // Adicionando o novo registro de horas
    estagiario.horas.push({ data, horaInicio, horaFim, total: totalMinutos });
    await estagiario.save();

    res.status(201).json(estagiario);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao registrar horas." });
  }
});

// Rota para exportar os dados como CSV
app.get("/api/exportar", async (req, res) => {
  try {
    const estagiarios = await Estagiario.find();
    const dataToExport = estagiarios.map((estagiario) => {
      const totalHoras = estagiario.horas.reduce((total, hora) => total + (hora.total || 0), 0);
      return {
        nome: estagiario.nome,
        email: estagiario.email,
        totalHoras: Math.floor(totalHoras / 60),
        totalMinutos: totalHoras % 60,
      };
    });

    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(dataToExport);

    fs.writeFileSync("estagiarios.csv", csv);
    res.download("estagiarios.csv");
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao exportar CSV." });
  }
});

// Rota para remover estagiário
app.delete("/api/estagiarios/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Estagiario.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: "Estagiário não encontrado." });
    }
    res.sendStatus(204);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao remover estagiário." });
  }
});

// Rota principal
app.get("/", (req, res) => {
  res.status(200).json({ message: "Bem-vindo à API" });
});

// Iniciando o servidor
const PORT = process.env.PORT || 80;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
