const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const app = express()
require('dotenv').config()

const port = process.env.PORT || 5000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://job-portal-b30d2.web.app',
    'https://job-portal-b30d2.firebaseapp.com'
  ],
  credentials: true
}))
app.use(express.json())
app.use(cookieParser())

const logger = (req, res, next) => {
  console.log('inside the logger');
  next()
}

const VerifyToken = (req, res, next) => {
  // console.log('inside verify token middleware',req.cookies);
  const token = req?.cookies?.token
  if (!token) {
    return res.status(401).send({ message: 'Unauthorized Access' })
  }

  // verify the token
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'unauthorized access' })
    }
    req.user = decoded
  })
  next()
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.esqhd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");

    // jobs related apis
    const jobsCollection = client.db('jobPortal').collection('jobs')
    const jobApplicationCollection = client.db('jobPortal').collection('job_applications')

    // Auth related Apis
    app.post('/jwt', (req, res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '10h' })
      res.cookie('token', token, {
        httpOnly: true,
        secure: false
      })
        .send({ success: true })

    })

    app.post('/logout', (req, res) => {
      res.clearCookie('token', {
        httpOnly: true,
        secure: false
      })
        .send({ success: true })
    })


    // jobs Related APIS
    app.get('/jobs', logger, async (req, res) => {
      console.log('now inside the api call back');
      const email = req.query.email
      let query = {}
      if (email) {
        query = { hr_email: email }
      }
      const cursor = jobsCollection.find(query)
      const result = await cursor.toArray()
      res.send(result)
    })

    app.get('/jobs/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await jobsCollection.findOne(query)
      res.send(result)
    })

    app.post('/jobs', async (req, res) => {
      const newJob = req.body
      const result = await jobsCollection.insertOne(newJob)
      res.send(result)
    })

    // job application apis
    // get all data, get one data,get some data [0,1,many]
    app.get('/job-application', VerifyToken, async (req, res) => {
      const email = req.query.email
      const query = { applicant_email: email }
      // console.log('cuk cuk cookies', req.cookies);

      if (req.user.email !== req.query.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }

      const result = await jobApplicationCollection.find(query).toArray()

      // fokira way to aggregate data
      for (const application of result) {
        console.log(application.job_id)
        const query1 = { _id: new ObjectId(application.job_id) }
        const job = await jobsCollection.findOne(query1)
        if (job) {
          application.title = job.title
          application.location = job.location
          application.company = job.company
          application.company_logo = job.company_logo
        }
      }


      res.send(result)
    })

    app.get('/job-applications/jobs/:job_id', async (req, res) => {
      const jobId = req.params.job_id
      const query = { job_id: jobId }
      const result = await jobApplicationCollection.find(query).toArray()
      res.send(result)
    })

    app.post('/job-applications', async (req, res) => {
      const application = req.body
      const result = await jobApplicationCollection.insertOne(application)
      res.send(result)

    })

    app.patch('/job-applications/:id', async (req, res) => {
      const id = req.params.id
      const data = req.body
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          status: data.status
        }
      }
      const result = await jobApplicationCollection.updateOne(filter, updatedDoc)
      res.send(result)
    })

  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('job is falling from the sky')
})

app.listen(port, () => {
  console.log(`job is waiting at: ${port}`);
})