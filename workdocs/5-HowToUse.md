### How to Use

## Installation

```bash
npm install @decaf-ts/for-postgres
```

## Examples

### Setting up the PostgreSQL Adapter

#### Description
This example demonstrates how to create and initialize a PostgreSQL adapter for connecting to a PostgreSQL database.

```typescript
import { PostgresAdapter } from '@decaf-ts/for-postgres';
import { Pool } from 'pg';

// Create a PostgreSQL connection pool
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'mydb',
  password: 'password',
  port: 5432,
});

// Create a PostgreSQL adapter
const adapter = new PostgresAdapter(pool);

// Initialize the adapter
await adapter.initialize();

console.log('PostgreSQL adapter initialized successfully');
```

### Defining a Model

#### Description
This example shows how to define a model class that can be used with the PostgreSQL adapter.

```typescript
import { Model } from '@decaf-ts/decorator-validation';
import { required, readonly } from '@decaf-ts/db-decorators';

export class User extends Model {
  @readonly()
  id: string;

  @required()
  username: string;

  @required()
  email: string;

  password: string;

  createdAt: Date;

  constructor(data?: Partial<User>) {
    super();
    if (data) {
      Object.assign(this, data);
    }
    this.createdAt = new Date();
  }
}
```

### Creating a Repository

#### Description
This example demonstrates how to create a repository for a specific model using the PostgreSQL adapter.

```typescript
import { Repository } from '@decaf-ts/core';
import { PostgresAdapter } from '@decaf-ts/for-postgres';
import { User } from './models/User';

// Assuming adapter is already initialized
const userRepository = Repository.for<User>(User, adapter);

// Now you can use the repository to interact with the User table
```

### Performing CRUD Operations

#### Description
This example shows how to perform Create, Read, Update, and Delete operations using a repository.

```typescript
import { Repository } from '@decaf-ts/core';
import { PostgresAdapter } from '@decaf-ts/for-postgres';
import { User } from './models/User';

async function crudOperations() {
  // Assuming adapter is already initialized
  const userRepository = Repository.for<User>(User, adapter);

  // Create a new user
  const newUser = new User({
    username: 'johndoe',
    email: 'john.doe@example.com',
    password: 'securepassword'
  });

  const createdUser = await userRepository.create(newUser);
  console.log('Created user:', createdUser);

  // Read a user by ID
  const userId = createdUser.id;
  const retrievedUser = await userRepository.read(userId);
  console.log('Retrieved user:', retrievedUser);

  // Update a user
  retrievedUser.email = 'john.updated@example.com';
  const updatedUser = await userRepository.update(retrievedUser);
  console.log('Updated user:', updatedUser);

  // Delete a user
  await userRepository.delete(userId);
  console.log('User deleted successfully');
}
```

### Building Queries with PostgresStatement

#### Description
This example demonstrates how to build and execute SQL queries using the PostgresStatement class.

```typescript
import { PostgresAdapter, PostgresStatement } from '@decaf-ts/for-postgres';
import { User } from './models/User';

async function queryBuilding(adapter: PostgresAdapter) {
  // Create a statement
  const statement = new PostgresStatement(adapter);

  // Build a query to find users with a specific email domain
  statement
    .from('users')
    .where('email', 'LIKE', '%@example.com')
    .orderBy('username', 'ASC');

  // Execute the query
  const results = await statement.build();
  console.log('Query results:', results);

  // You can also execute raw SQL queries
  const rawResults = await statement.raw({
    query: 'SELECT * FROM users WHERE created_at > $1',
    values: [new Date('2023-01-01')]
  });
  console.log('Raw query results:', rawResults);
}
```

### Using Pagination

#### Description
This example shows how to implement pagination for query results using the PostgresPaginator class.

```typescript
import { PostgresAdapter, PostgresStatement } from '@decaf-ts/for-postgres';
import { User } from './models/User';

async function paginationExample(adapter: PostgresAdapter) {
  // Create a statement
  const statement = new PostgresStatement(adapter);

  // Set up the base query
  statement
    .from('users')
    .orderBy('created_at', 'DESC');

  // Create a paginator with page size of 10
  const paginator = statement.paginate(10);

  // Get the first page
  const page1 = await paginator.page(1);
  console.log('Page 1:', page1);

  // Get the second page
  const page2 = await paginator.page(2);
  console.log('Page 2:', page2);

  // Get total pages and record count
  console.log('Total pages:', paginator.total);
  console.log('Total records:', paginator.count);
}
```

### Working with Sequences

#### Description
This example demonstrates how to work with PostgreSQL sequences using the PostgresSequence class.

```typescript
import { PostgresAdapter } from '@decaf-ts/for-postgres';
import { SequenceOptions } from '@decaf-ts/core';

async function sequenceExample(adapter: PostgresAdapter) {
  // Define sequence options
  const sequenceOptions: SequenceOptions = {
    name: 'user_id_seq',
    type: 'Number',
    startWith: 1000,
    incrementBy: 1
  };

  // Create a sequence
  const sequence = adapter.Sequence(sequenceOptions);

  // Get the current value
  const currentValue = await sequence.current();
  console.log('Current sequence value:', currentValue);

  // Get the next value
  const nextValue = await sequence.next();
  console.log('Next sequence value:', nextValue);

  // Get a range of values
  const rangeValues = await sequence.range(5);
  console.log('Range of sequence values:', rangeValues);
}
```

### Setting Up Real-time Notifications

#### Description
This example shows how to set up and use the PostgresDispatch class for real-time notifications.

```typescript
import { PostgresDispatch } from '@decaf-ts/for-postgres';
import { Pool } from 'pg';

async function notificationsExample() {
  // Create a dispatch instance with a timeout of 30 seconds
  const dispatch = new PostgresDispatch(30000);

  // Initialize the dispatch
  await dispatch.initialize();

  // Subscribe to a notification channel
  dispatch.on('user_created', (payload) => {
    console.log('New user created:', payload);
  });

  // Later, when you're done
  await dispatch.cleanup();
}
```

### Generating Indexes

#### Description
This example demonstrates how to generate index configurations for your models.

```typescript
import { generateIndexes } from '@decaf-ts/for-postgres';
import { User } from './models/User';
import { Product } from './models/Product';

function indexGenerationExample() {
  // Generate indexes for multiple models
  const indexConfigs = generateIndexes([User, Product]);

  console.log('Generated index configurations:', indexConfigs);

  // You can then use these configurations to create indexes in your database
}
```

### Database Administration

#### Description
This example shows how to perform database administration tasks using the PostgresAdapter.

```typescript
import { PostgresAdapter } from '@decaf-ts/for-postgres';
import { Pool } from 'pg';

async function databaseAdminExample() {
  // Create a connection pool for the postgres database
  const adminPool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres', // Connect to default postgres database
    password: 'password',
    port: 5432,
  });

  // Create a new database
  await PostgresAdapter.createDatabase(adminPool, 'mynewdb');
  console.log('Database created successfully');

  // Create a new user
  await PostgresAdapter.createUser(adminPool, 'mynewdb', 'newuser', 'newpassword');
  console.log('User created successfully');

  // Get current user
  const currentUser = await PostgresAdapter.getCurrentUser(adminPool);
  console.log('Current user:', currentUser);

  // Create a table for a model
  const adapter = new PostgresAdapter(adminPool);
  await adapter.createTable(adminPool, User);
  console.log('Table created successfully');

  // Delete a user
  await PostgresAdapter.deleteUser(adminPool, 'newuser');
  console.log('User deleted successfully');

  // Delete a database
  await PostgresAdapter.deleteDatabase(adminPool, 'mynewdb');
  console.log('Database deleted successfully');
}
```

For more detailed information about the library's API and usage, please refer to the [API documentation](./tutorials/API.md).
